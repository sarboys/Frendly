import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

final appMediaPickerServiceProvider = Provider<AppMediaPickerService>(
  (ref) => NativeAppMediaPickerService(),
);

abstract class AppMediaPickerService {
  Future<PlatformFile?> pickFromCamera();
  Future<PlatformFile?> pickFromGallery();
  Future<List<PlatformFile>> pickMultipleFromGallery({required int limit});
}

class NativeAppMediaPickerService implements AppMediaPickerService {
  NativeAppMediaPickerService({
    ImagePicker? picker,
  }) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  bool get _supportsNativePicker =>
      kIsWeb || Platform.isAndroid || Platform.isIOS;

  @override
  Future<PlatformFile?> pickFromCamera() async {
    if (_supportsNativePicker) {
      return _pickImage(ImageSource.camera, fallbackToFilePicker: true);
    }
    return _pickWithFilePicker();
  }

  @override
  Future<PlatformFile?> pickFromGallery() async {
    if (_supportsNativePicker) {
      return _pickImage(ImageSource.gallery, fallbackToFilePicker: true);
    }
    return _pickWithFilePicker();
  }

  @override
  Future<List<PlatformFile>> pickMultipleFromGallery({
    required int limit,
  }) async {
    if (limit <= 0) {
      return const [];
    }
    if (_supportsNativePicker) {
      try {
        final files = await _picker.pickMultiImage(
          imageQuality: 90,
          limit: limit,
        );
        return Future.wait(
          files.take(limit).map(_platformFileFromXFile),
        );
      } catch (_) {
        return _pickMultipleWithFilePicker(limit: limit);
      }
    }

    return _pickMultipleWithFilePicker(limit: limit);
  }

  Future<List<PlatformFile>> _pickMultipleWithFilePicker({
    required int limit,
  }) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      allowMultiple: true,
      withData: false,
    );
    if (result == null || result.files.isEmpty) {
      return const [];
    }
    return result.files.take(limit).toList(growable: false);
  }

  Future<PlatformFile?> _pickWithFilePicker() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      withData: false,
    );
    if (result == null || result.files.isEmpty) {
      return null;
    }
    return result.files.single;
  }

  Future<PlatformFile?> _pickImage(
    ImageSource source, {
    bool fallbackToFilePicker = false,
  }) async {
    XFile? file;
    try {
      file = await _picker.pickImage(
        source: source,
        imageQuality: 90,
      );
    } catch (_) {
      if (!fallbackToFilePicker) {
        rethrow;
      }
      return _pickWithFilePicker();
    }
    if (file == null) {
      return null;
    }

    return _platformFileFromXFile(file);
  }

  Future<PlatformFile> _platformFileFromXFile(XFile file) async {
    final size = await file.length();
    final segments = file.path.split(RegExp(r'[\\/]'));
    final fallbackName = segments.isEmpty ? 'image.jpg' : segments.last;

    return PlatformFile(
      name: file.name.isEmpty ? fallbackName : file.name,
      size: size,
      bytes: null,
      path: file.path,
    );
  }
}
