import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_search_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PeopleScreen extends ConsumerWidget {
  const PeopleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final peopleAsync = ref.watch(peopleProvider);
    final people = peopleAsync.valueOrNull ?? const [];

    return Material(
      color: colors.background,
      child: SafeArea(
        bottom: false,
        child: peopleAsync.when(
          data: (_) => CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Text('Люди рядом', style: AppTextStyles.screenTitle),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.sm)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: BbSearchBar(
                    placeholder: 'Найти по имени или интересу',
                    readOnly: true,
                    onTap: () => context.pushRoute(AppRoute.search),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                sliver: SliverGrid(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final person = people[index];

                      return InkWell(
                        onTap: () => context.pushRoute(
                          AppRoute.userProfile,
                          pathParameters: {'userId': person.id},
                        ),
                        borderRadius: AppRadii.cardBorder,
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: AppRadii.cardBorder,
                            border: Border.all(color: colors.border),
                            boxShadow: AppShadows.soft,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  BbAvatar(
                                    name: person.name,
                                    size: BbAvatarSize.lg,
                                    online: person.online,
                                    imageUrl: person.avatarUrl,
                                  ),
                                  const Spacer(),
                                  if (person.verified)
                                    Container(
                                      width: 24,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        color: colors.secondarySoft,
                                        borderRadius:
                                            BorderRadius.circular(999),
                                      ),
                                      child: Icon(
                                        Icons.verified_rounded,
                                        size: 14,
                                        color: colors.secondary,
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                person.age == null
                                    ? person.name
                                    : '${person.name}, ${person.age}',
                                style: AppTextStyles.itemTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Icon(
                                    Icons.place_outlined,
                                    size: 12,
                                    color: colors.inkMute,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      person.area ?? '',
                                      style: AppTextStyles.caption,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Wrap(
                                spacing: 4,
                                runSpacing: 4,
                                children: person.common
                                    .take(2)
                                    .map(
                                      (tag) => Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: colors.muted,
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          tag,
                                          style: AppTextStyles.caption.copyWith(
                                            color: colors.inkSoft,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(growable: false),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                    childCount: people.length,
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.sm,
                    crossAxisSpacing: AppSpacing.sm,
                    childAspectRatio: 0.78,
                  ),
                ),
              ),
            ],
          ),
          loading: () => Center(
            child: CircularProgressIndicator(color: colors.primary),
          ),
          error: (_, __) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Не получилось загрузить людей рядом',
                style: AppTextStyles.body,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
