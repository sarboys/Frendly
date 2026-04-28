import { ProfileService } from '../../src/services/profile.service';

describe('ProfileService', () => {
  it('loads only fields needed for the profile response', async () => {
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'user-me',
      displayName: 'Никита',
      verified: false,
      online: true,
      profile: {
        age: 29,
        birthDate: null,
        gender: 'male',
        city: 'Москва',
        area: 'Патрики',
        bio: 'Люблю прогулки',
        vibe: 'Спокойно',
        rating: 0,
        meetupCount: 0,
        avatarUrl: null,
        photos: [],
      },
    });
    const service = new ProfileService({
      client: {
        user: {
          findUnique: userFindUnique,
        },
      },
    } as any);

    await expect(service.getProfile('user-me')).resolves.toMatchObject({
      id: 'user-me',
      displayName: 'Никита',
      photos: [],
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-me' },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
        profile: {
          select: {
            age: true,
            birthDate: true,
            gender: true,
            city: true,
            area: true,
            bio: true,
            vibe: true,
            rating: true,
            meetupCount: true,
            avatarUrl: true,
            photos: {
              select: {
                id: true,
                sortOrder: true,
                mediaAsset: {
                  select: {
                    id: true,
                    kind: true,
                    mimeType: true,
                    byteSize: true,
                    durationMs: true,
                    publicUrl: true,
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  });

  it('does not clear profile fields that are absent from patch payload', async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    const profileUpdate = jest.fn().mockResolvedValue({});
    const client = {
      $transaction: jest.fn((callback: any) =>
        callback({
          user: {
            update: userUpdate,
          },
          profile: {
            update: profileUpdate,
          },
        }),
      ),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          displayName: 'Никита',
          verified: false,
          online: true,
          profile: {
            age: 29,
            birthDate: null,
            gender: 'male',
            city: 'Москва',
            area: 'Патрики',
            bio: 'Люблю прогулки',
            vibe: 'Спокойно',
            rating: 0,
            meetupCount: 0,
            avatarUrl: null,
            avatarAssetId: null,
            photos: [],
          },
        }),
      },
    };
    const service = new ProfileService({ client } as any);

    await service.updateProfile('user-me', {
      displayName: '  Никита  ',
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-me' },
      data: { displayName: 'Никита' },
    });
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('rejects avatar upload urls for unsupported mime types', async () => {
    const service = new ProfileService({ client: {} } as any);

    await expect(
      service.getAvatarUploadUrl('user-me', {
        fileName: 'avatar.svg',
        contentType: 'image/svg+xml',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_avatar_mime_type',
    });
  });

  it('returns an existing avatar asset when avatar complete is retried', async () => {
    const existingAsset = {
      id: 'avatar-asset-existing',
      ownerId: 'user-me',
      kind: 'avatar',
      status: 'ready',
      bucket: 'big-break',
      objectKey: 'avatars/user-me/avatar.png',
      mimeType: 'image/png',
      byteSize: 2048,
      durationMs: null,
      waveform: [],
      originalFileName: 'avatar.png',
      publicUrl: 'https://cdn.example.com/avatars/user-me/avatar.png',
      error: null,
      chatId: null,
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      updatedAt: new Date('2026-04-24T00:00:00.000Z'),
    };
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(existingAsset),
        create: jest.fn(),
      },
      profile: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProfileService({ client } as any);

    await expect(
      service.completeAvatarUpload('user-me', {
        objectKey: 'avatars/user-me/avatar.png',
        mimeType: 'image/png',
        byteSize: 2048,
        fileName: 'avatar.png',
      }),
    ).resolves.toEqual({
      assetId: 'avatar-asset-existing',
      status: 'ready',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
    expect(client.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      data: {
        avatarAssetId: 'avatar-asset-existing',
        avatarUrl: 'https://cdn.example.com/avatars/user-me/avatar.png',
      },
    });
  });

  it('returns an existing profile photo when direct upload complete is retried', async () => {
    const existingPhoto = {
      id: 'photo-existing',
      profileUserId: 'user-me',
      mediaAssetId: 'asset-existing',
      sortOrder: 0,
      mediaAsset: {
        id: 'asset-existing',
        ownerId: 'user-me',
        kind: 'avatar',
        status: 'ready',
        bucket: 'big-break',
        objectKey: 'avatars/user-me/photo.png',
        mimeType: 'image/png',
        byteSize: 2048,
        durationMs: null,
        waveform: [],
        originalFileName: 'photo.png',
        publicUrl: 'https://cdn.example.com/avatars/user-me/photo.png',
        error: null,
        chatId: null,
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
        updatedAt: new Date('2026-04-24T00:00:00.000Z'),
      },
    };
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(existingPhoto.mediaAsset),
      },
      profilePhoto: {
        findUnique: jest.fn().mockResolvedValue(existingPhoto),
      },
      $transaction: jest.fn(),
    };
    const service = new ProfileService({ client } as any);

    const result = await service.completeProfilePhotoUpload('user-me', {
      objectKey: 'avatars/user-me/photo.png',
      mimeType: 'image/png',
      byteSize: 2048,
      fileName: 'photo.png',
    });

    expect(result).toMatchObject({
      assetId: 'asset-existing',
      status: 'ready',
      url: 'https://cdn.example.com/avatars/user-me/photo.png',
      photo: {
        id: 'photo-existing',
        media: {
          id: 'asset-existing',
        },
      },
    });
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.mediaAsset.findUnique).toHaveBeenCalledWith({
      where: { objectKey: 'avatars/user-me/photo.png' },
      select: {
        id: true,
        ownerId: true,
        kind: true,
        status: true,
        publicUrl: true,
      },
    });
    expect(client.profilePhoto.findUnique).toHaveBeenCalledWith({
      where: { mediaAssetId: 'asset-existing' },
      select: {
        profileUserId: true,
        id: true,
        sortOrder: true,
        mediaAsset: {
          select: {
            id: true,
            kind: true,
            mimeType: true,
            byteSize: true,
            durationMs: true,
            publicUrl: true,
          },
        },
      },
    });
  });

  it('rejects empty avatar direct completes', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'asset-new',
          status: 'ready',
        }),
      },
      profile: {
        update: jest.fn(),
      },
    };
    const service = new ProfileService({ client } as any);

    await expect(
      service.completeAvatarUpload('user-me', {
        objectKey: 'avatars/user-me/avatar.png',
        mimeType: 'image/png',
        byteSize: 0,
        fileName: 'avatar.png',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_avatar_size',
    });
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
    expect(client.profile.update).not.toHaveBeenCalled();
  });

  it('rejects empty profile photo direct completes', async () => {
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };
    const service = new ProfileService({ client } as any);

    await expect(
      service.completeProfilePhotoUpload('user-me', {
        objectKey: 'avatars/user-me/photo.png',
        mimeType: 'image/png',
        byteSize: 0,
        fileName: 'photo.png',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_avatar_size',
    });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('locks profile photo ordering before appending a direct upload photo', async () => {
    const lockProfile = jest.fn().mockResolvedValue(1);
    const profilePhotoFindFirst = jest
      .fn()
      .mockResolvedValueOnce({
        sortOrder: 2,
      })
      .mockResolvedValueOnce({
        mediaAssetId: 'asset-new',
        mediaAsset: {
          publicUrl: 'https://cdn.example.com/avatars/user-me/photo.png',
        },
      });
    const client = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback: any) =>
        callback({
          $executeRaw: lockProfile,
          mediaAsset: {
            create: jest.fn().mockResolvedValue({
              id: 'asset-new',
              ownerId: 'user-me',
              kind: 'avatar',
              status: 'ready',
              bucket: 'big-break',
              objectKey: 'avatars/user-me/photo.png',
              mimeType: 'image/png',
              byteSize: 2048,
              durationMs: null,
              waveform: [],
              originalFileName: 'photo.png',
              publicUrl: 'https://cdn.example.com/avatars/user-me/photo.png',
              error: null,
              chatId: null,
              createdAt: new Date('2026-04-24T00:00:00.000Z'),
              updatedAt: new Date('2026-04-24T00:00:00.000Z'),
            }),
          },
          profilePhoto: {
            findFirst: profilePhotoFindFirst,
            create: jest.fn().mockResolvedValue({
              id: 'photo-new',
              profileUserId: 'user-me',
              mediaAssetId: 'asset-new',
              sortOrder: 3,
              mediaAsset: {
                id: 'asset-new',
                ownerId: 'user-me',
                kind: 'avatar',
                status: 'ready',
                bucket: 'big-break',
                objectKey: 'avatars/user-me/photo.png',
                mimeType: 'image/png',
                byteSize: 2048,
                durationMs: null,
                waveform: [],
                originalFileName: 'photo.png',
                publicUrl: 'https://cdn.example.com/avatars/user-me/photo.png',
                error: null,
                chatId: null,
                createdAt: new Date('2026-04-24T00:00:00.000Z'),
                updatedAt: new Date('2026-04-24T00:00:00.000Z'),
              },
            }),
          },
          profile: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };
    const service = new ProfileService({ client } as any);

    await service.completeProfilePhotoUpload('user-me', {
      objectKey: 'avatars/user-me/photo.png',
      mimeType: 'image/png',
      byteSize: 2048,
      fileName: 'photo.png',
    });

    expect(lockProfile).toHaveBeenCalledTimes(1);
    expect(lockProfile.mock.invocationCallOrder[0]!).toBeLessThan(
      profilePhotoFindFirst.mock.invocationCallOrder[0]!,
    );
  });

  it('locks profile photo ordering before inserting an uploaded avatar as primary', async () => {
    const lockProfile = jest.fn().mockResolvedValue(1);
    const profilePhotoUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const client = {
      $transaction: jest.fn((callback: any) =>
        callback({
          $executeRaw: lockProfile,
          profilePhoto: {
            updateMany: profilePhotoUpdateMany,
            create: jest.fn().mockResolvedValue({
              id: 'photo-new',
              profileUserId: 'user-me',
              mediaAssetId: 'asset-new',
              sortOrder: 0,
              mediaAsset: {
                id: 'asset-new',
                ownerId: 'user-me',
                kind: 'avatar',
                status: 'ready',
                bucket: '__inline__',
                objectKey: 'inline-avatar/user-me/photo.png',
                mimeType: 'image/png',
                byteSize: 4,
                durationMs: null,
                waveform: [],
                originalFileName: 'photo.png',
                publicUrl: 'data:image/png;base64,dGVzdA==',
                error: null,
                chatId: null,
                createdAt: new Date('2026-04-24T00:00:00.000Z'),
                updatedAt: new Date('2026-04-24T00:00:00.000Z'),
              },
            }),
          },
          mediaAsset: {
            create: jest.fn().mockResolvedValue({
              id: 'asset-new',
              ownerId: 'user-me',
              kind: 'avatar',
              status: 'ready',
              bucket: '__inline__',
              objectKey: 'inline-avatar/user-me/photo.png',
              mimeType: 'image/png',
              byteSize: 4,
              durationMs: null,
              waveform: [],
              originalFileName: 'photo.png',
              publicUrl: 'data:image/png;base64,dGVzdA==',
              error: null,
              chatId: null,
              createdAt: new Date('2026-04-24T00:00:00.000Z'),
              updatedAt: new Date('2026-04-24T00:00:00.000Z'),
            }),
          },
          profile: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };
    const service = new ProfileService({ client } as any);

    await service.uploadAvatarFile('user-me', {
      mimetype: 'image/png',
      size: 4,
      originalname: 'photo.png',
      buffer: Buffer.from('test'),
    } as Express.Multer.File);

    expect(lockProfile).toHaveBeenCalledTimes(1);
    expect(lockProfile.mock.invocationCallOrder[0]!).toBeLessThan(
      profilePhotoUpdateMany.mock.invocationCallOrder[0]!,
    );
  });

  it('creates avatar file upload records with only response fields', async () => {
    const asset = {
      id: 'asset-new',
      kind: 'avatar',
      status: 'ready',
      mimeType: 'image/png',
      byteSize: 4,
      durationMs: null,
      publicUrl: 'data:image/png;base64,dGVzdA==',
    };
    const mediaAssetCreate = jest.fn().mockResolvedValue(asset);
    const profilePhotoCreate = jest.fn().mockResolvedValue({
      id: 'photo-new',
      sortOrder: 0,
      mediaAsset: asset,
    });
    const client = {
      $transaction: jest.fn((callback: any) =>
        callback({
          $executeRaw: jest.fn().mockResolvedValue(1),
          profilePhoto: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: profilePhotoCreate,
          },
          mediaAsset: {
            create: mediaAssetCreate,
          },
          profile: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };
    const service = new ProfileService({ client } as any);

    await expect(
      service.uploadAvatarFile('user-me', {
        mimetype: 'image/png',
        size: 4,
        originalname: 'photo.png',
        buffer: Buffer.from('test'),
      } as Express.Multer.File),
    ).resolves.toMatchObject({
      assetId: 'asset-new',
      status: 'ready',
      media: {
        id: 'asset-new',
      },
      photo: {
        id: 'photo-new',
      },
    });
    expect(mediaAssetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          kind: true,
          status: true,
          mimeType: true,
          byteSize: true,
          durationMs: true,
          publicUrl: true,
        },
      }),
    );
    expect(profilePhotoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          sortOrder: true,
          mediaAsset: {
            select: {
              id: true,
              kind: true,
              mimeType: true,
              byteSize: true,
              durationMs: true,
              publicUrl: true,
            },
          },
        },
      }),
    );
  });

  it('creates profile photo file upload records with only response fields', async () => {
    const mediaAssetCreate = jest.fn().mockResolvedValue({
      id: 'asset-new',
      status: 'ready',
      publicUrl: 'data:image/png;base64,dGVzdA==',
    });
    const profilePhotoCreate = jest.fn().mockResolvedValue({
      id: 'photo-new',
      sortOrder: 2,
      mediaAsset: {
        id: 'asset-new',
        kind: 'avatar',
        mimeType: 'image/png',
        byteSize: 4,
        durationMs: null,
        publicUrl: 'data:image/png;base64,dGVzdA==',
      },
    });
    const profilePhotoFindFirst = jest
      .fn()
      .mockResolvedValueOnce({ sortOrder: 1 })
      .mockResolvedValueOnce({
        mediaAssetId: 'asset-new',
        mediaAsset: {
          publicUrl: 'data:image/png;base64,dGVzdA==',
        },
      });
    const client = {
      $transaction: jest.fn((callback: any) =>
        callback({
          $executeRaw: jest.fn().mockResolvedValue(1),
          mediaAsset: {
            create: mediaAssetCreate,
          },
          profilePhoto: {
            findFirst: profilePhotoFindFirst,
            create: profilePhotoCreate,
          },
          profile: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };
    const service = new ProfileService({ client } as any);

    await expect(
      service.uploadProfilePhotoFile('user-me', {
        mimetype: 'image/png',
        size: 4,
        originalname: 'photo.png',
        buffer: Buffer.from('test'),
      } as Express.Multer.File),
    ).resolves.toMatchObject({
      assetId: 'asset-new',
      status: 'ready',
      photo: {
        id: 'photo-new',
      },
    });
    expect(mediaAssetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
          publicUrl: true,
        },
      }),
    );
    expect(profilePhotoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          sortOrder: true,
          mediaAsset: {
            select: {
              id: true,
              kind: true,
              mimeType: true,
              byteSize: true,
              durationMs: true,
              publicUrl: true,
            },
          },
        },
      }),
    );
    expect(profilePhotoFindFirst).toHaveBeenLastCalledWith({
      where: { profileUserId: 'user-me' },
      select: {
        mediaAssetId: true,
        mediaAsset: {
          select: {
            publicUrl: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('rejects duplicate ids when reordering profile photos', async () => {
    const profilePhotoUpdate = jest.fn().mockResolvedValue({});
    const client = {
      $transaction: jest.fn((callback: any) =>
        callback({
          profilePhoto: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'photo-1', sortOrder: 0 },
              { id: 'photo-2', sortOrder: 1 },
            ]),
            update: profilePhotoUpdate,
            findFirst: jest.fn().mockResolvedValue(null),
          },
          profile: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          displayName: 'User',
          verified: false,
          profile: {
            age: null,
            birthDate: null,
            gender: null,
            city: null,
            area: null,
            bio: null,
            vibe: null,
            rating: 0,
            meetupCount: 0,
            avatarUrl: null,
            avatarAssetId: null,
            photos: [],
          },
        }),
      },
    };
    const service = new ProfileService({ client } as any);

    await expect(
      service.reorderProfilePhotos('user-me', {
        photoIds: ['photo-1', 'photo-1'],
      }),
    ).rejects.toMatchObject({
      code: 'invalid_profile_photo_order',
    });
    expect(profilePhotoUpdate).not.toHaveBeenCalled();
  });
});
