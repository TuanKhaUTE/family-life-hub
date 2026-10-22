# Family Life Hub — Design System

## 1. Design Vision

Family Life Hub should feel like a warm digital home.

The interface should communicate:

- warmth;
- family;
- comfort;
- friendliness;
- simplicity;
- playfulness;
- trust.

The application should not look like:

- a corporate SaaS dashboard;
- a banking application;
- a cyber-security dashboard;
- a gaming interface;
- an AI chatbot product;
- a neon or futuristic application.

The visual identity should feel modern but emotionally warm.

The primary end-user UI language is Vietnamese.

Primary design keywords:

Cozy

Warm

Family-oriented

Friendly

Soft

Playful

Personal

Calm

Mobile-first

---

# 2. Core Visual Direction

Preferred visual characteristics:

- warm cream backgrounds;
- soft white cards;
- sage green;
- peach;
- warm orange;
- terracotta;
- soft brown text;
- rounded cards;
- gentle shadows;
- friendly illustrations;
- subtle motion.

Avoid excessive:

- glassmorphism;
- gradients;
- neon colors;
- glowing borders;
- 3D effects;
- dark cyber aesthetics;
- overly dense dashboards.

---

# 3. Initial Color System

The following colors define the initial direction.

These values may be refined during implementation.

## Background

Warm Cream:

#FFF9F3

Secondary Cream:

#FDF2E7

## Surface

White:

#FFFFFF

Soft Surface:

#FFFDFC

## Primary

Sage Green:

#93B995

Deep Sage:

#66896B

## Secondary

Soft Peach:

#F6B38E

Warm Terracotta:

#D97A5B

## Accent

Warm Yellow:

#F4C86A

Soft Rose:

#EFA7A7

## Text

Primary Text:

#493B32

Secondary Text:

#77665B

Muted Text:

#9A8B82

## Status

Success:

#719B76

Warning:

#DFA44A

Error:

#C96A63

Info:

#7397B8

Colors should maintain sufficient contrast and should not be used purely decoratively when they communicate important state.

---

# 4. Typography

Typography should feel friendly and highly readable.

Preferred characteristics:

- rounded or humanist sans-serif;
- readable Vietnamese characters;
- comfortable line-height;
- no overly technical monospace styling in normal UI.

Possible font direction:

Primary UI:
Inter, Nunito Sans, or similar.

Friendly display headings:
Nunito, Quicksand, or similar.

The final font should support Vietnamese well.

Use no more than two primary font families.

---

# 5. Typography Hierarchy

Large page greeting:

32–40px desktop

28–32px mobile

Page title:

24–30px

Section title:

18–22px

Card title:

16–18px

Body:

14–16px

Caption:

12–14px

Avoid tiny text for important information.

---

# 6. Shape Language

The application should use soft rounded geometry.

Suggested radius:

Small controls:
10–12px

Buttons:
12–16px

Cards:
18–24px

Major hero sections:
24–32px

Avoid sharp square panels unless a specific component requires them.

---

# 7. Shadows

Shadows should be subtle.

Cards should feel lifted gently rather than floating dramatically.

Avoid:

- strong black shadows;
- large blurred neon shadows;
- glow effects on every component.

Warm or neutral low-opacity shadows are preferred.

---

# 8. Layout

The application is mobile-first.

Primary mobile layout:

Header

Greeting / context

Important action

Current household information

Module cards

Bottom navigation

Desktop layout may introduce:

- sidebar navigation;
- wider cards;
- multi-column dashboard;
- richer statistics.

The mobile experience remains the priority.

---

# 9. Navigation

The implemented mobile shell uses role-aware destinations. PARENT:

- Trang chủ
- Bếp
- Lịch
- Chi tiêu
- Cá nhân

ADMIN/MEMBER uses Trang chủ, Bếp, Lịch, Học & Luyện, and Cá nhân instead. Feature 5A exposes Chi tiêu cá nhân from Cá nhân without adding a sixth navigation item. Features 4A–4C replace Học tập and Rèn luyện placeholders with private functional workspaces and grades, without fake numbers or charts.

Use a persistent bottom navigation with simple icons, short Vietnamese labels, comfortable touch targets, and bottom safe-area spacing. Bếp contains the meal workflows. Unimplemented modules remain warm placeholders. Navigation is not a substitute for backend authorization.

Trang chủ uses a cream greeting hero, soft peach/yellow attention card, sage breakfast and peach dinner summaries, recent-dish rating summaries, and muted future-module cards. Home links to Bếp instead of duplicating forms. Show only real actionable items; the calm empty state is “Hôm nay mọi việc đang ổn 💚”. Use Vietnamese family dates, warm loading cards, and a friendly retry state.

The authenticated header contains a notification bell. Show a badge only when unread count is greater than zero. The bell opens a lightweight dismissible sheet; notifications are not permanently expanded on the page.

The final information architecture should avoid presenting too many bottom-navigation items.

More specialized modules may be accessed from the dashboard or profile.

---

# 10. Role-Based Dashboards

Dashboards should adapt to the current user.

## Mom

Prioritize:

- children's meal selections;
- create meal request;
- meal readiness;
- dishwashing schedule;
- family timetable;
- food spending;
- recent cooking feedback.

## Kha / Bin

Prioritize:

- meal selection;
- today's classes;
- dishwashing duty;
- study progress;
- fitness progress;
- personal expenses;
- notifications.

Do not show irrelevant administrative information on normal dashboards.

---

# 11. Family Identity

The application should feel personal to this family.

Possible identity elements:

- Mom represented as the family chef;
- friendly illustrated cooking elements;
- personalized names such as Tun Tun and Bin Bin;
- conversational Vietnamese copy;
- warm household imagery.

Example greeting:

"Chào buổi sáng, Tun Tun ☀️"

Example Mom card:

"Mẹ đang chờ hai đứa chọn món đó nha 🍳"

Avoid overusing emojis.

Emojis should support personality rather than replace UI icons everywhere.

---

# 12. Avatar System

Users may use:

- preset illustrated avatars;
- emoji-based avatars;
- uploaded personal avatars.

Avatar components should use consistent circular or softly rounded containers.

The profile selector should make identifying family members extremely easy.

---

# 13. Login Screen

The login screen should not look like enterprise authentication.

Preferred concept:

"Nhà mình hôm nay ai vào đây?"

Profile cards:

Mom

Tun Tun

Bin Bin

After selecting a member:

Enter PIN

The experience should feel welcoming and personal.

---

# 14. Meal UI

Meals are one of the main emotional centers of the application.

Meal cards should visually distinguish:

Breakfast

Lunch

Dinner

without using completely different visual styles.

Breakfast may use:

- warm yellow;
- sunrise imagery;
- breakfast icons.

Lunch:

- sage / green accents.

Dinner:

- warmer orange / terracotta accents.

These are accents only.

The overall application palette must remain consistent.

---

# 15. Meal Selection Cards

Dish options should be easy to tap on mobile.

Each dish card may include:

- dish name;
- optional illustration/icon;
- selected state.

Important special actions:

Other / Custom

Not eating

These should remain visually clear and distinct from normal dishes.

"Not eating" must not look like an error state.

---

# 16. Meal Request UI

Correction Batch A simplifies dinner to “Hôm nay mọi người muốn ăn gì?”, optional family message, and a time-only deadline defaulting to 14:00. Do not show mode selectors, structured poll cards or option builders. Children use one focused text reply; saved replies collapse and deadline-expired replies are read-only. Preserve response-derived finalization and the secondary “Thêm món khác”. Breakfast uses 18:00–01:00 family-time editing, calm locked/no-response states, and only a compact purchased summary/message after confirmation; never leave the large old chooser underneath. Notification sheets acknowledge visible unread items automatically, with no normal mark-read button and truthful retry feedback.

Feature 2G uses three distinct daily regions: peach **Bữa sáng tiếp theo**, sage **Bữa tối hôm nay**, and warm yellow/cream **Bữa tối đã chốt**. Do not show lunch, calendar date pickers, future planning, or cancelled/history cards in normal Bếp. Dinner deadlines use time-only controls. Parent finalization starts with **Món hai đứa đã chọn** candidates; **Thêm món khác** stays secondary. Category controls are optional, not mandatory setup. **Xóa kế hoạch** confirms removal from the active view while history remains internal.

Parent-created meal requests should feel conversational.

Example:

"Mẹ có gà rồi, hai đứa muốn ăn món nào?"

Children answer with one free-text field. Legacy option labels remain readable in saved responses; no new option-card builder is exposed.

Deadline should be visible but secondary.

Example:

"Chọn trước 12:00"

Responses should clearly show who has responded.

---

# 17. Ratings

Ratings use a friendly five-star experience.

Users should be able to:

select stars;

write an optional comment.

Mom's feedback view should focus on useful comments rather than numerical scoring alone.

Avoid designs that make low ratings feel hostile.

Ready-meal dish cards start with **Đánh giá món**, not permanently open forms. Use native keyboard-accessible star radio inputs with at least 44px touch targets and visible focus. Saving collapses to stars, optional comment, and **Chỉnh sửa đánh giá**; reopening restores the values. PARENT sees warm, named feedback grouped by dish, with no inputs. All new feedback states and actions use natural Vietnamese.

In the main kitchen, show only the compact **Đánh giá bữa tối** / **Xem góp ý bữa ăn** action. Open the existing per-dish experience in a separate focused sheet with Escape dismissal, contained keyboard focus, body scroll locking and restored trigger focus. Do not render rating forms/comments inline. Ready meals expose only message editing, never composition controls.

---

# 18. Timetable Design

Feature 3B's Lịch is a mobile-first family calendar headed “Lịch” / “Cùng nhau sắp xếp thời gian”. Default to today's vertical timeline, with Today/Week controls, date navigation, and active-member chips. Use cream surfaces, sage/peach/lavender/blue owner cards, avatars, category icons, and timeline dots. Labels and dates remain Vietnamese. Preserve comfortable touch targets at 320px and 390px, not a shrunken month grid.

Own event details offer explicit edit/delete controls; another owner's details are read-only regardless of role. Weekly details distinguish “Chỉnh sửa lần này”, “Chỉnh sửa cả lịch”, “Hủy lần này”, and confirmed “Xóa cả lịch”. Cancelled occurrences stay visibly marked. The shared form closes after a successful save. Feature 3C adds real household chores in a separate section beneath the timeline, never as fake calendar events.

Home's calendar placeholder is replaced with a compact “Lịch gia đình hôm nay” (PARENT) / “Lịch của bạn hôm nay” (ADMIN/MEMBER) card, owner avatars, up to three real upcoming/ongoing items, a calm empty state, and “Xem lịch”. No full editor is duplicated on Home.

Timetable views should prioritize readability.

Mobile:

day-based cards or horizontal day selector.

Desktop:

weekly calendar view may be used.

Class cards should display:

subject;

start time;

end time;

status.

Cancelled sessions should remain visible but clearly marked.

---

# 19. Chores

Household duties should feel friendly and collaborative, never punitive. Use “Việc nhà hôm nay”, “Giao cho”, “Sau bữa tối”, and “Đã làm xong”, with warm household icons, cream/yellow/sage rounded cards, member avatars, and readable Vietnamese dates. Keep chores visually separate from the calendar timeline.

PARENT manages through “Quản lý việc nhà”, “Thêm việc”, and “Lịch lặp hàng tuần”. The weekly form uses seven familiar weekday/member selectors, not technical recurrence syntax. All controls must remain comfortable at 320px and 390px, with visible focus states and touch targets of at least 44px. Forms collapse after successful saves.

Members' own chores appear first with a completion button only when eligible; other members' chores remain read-only. Completed cards collapse to “Hoàn thành ✓” without repeated completion controls. Cancellation is clearly distinct from completion. Home presents up to three compact chore summaries with “Xem lịch”, not management forms. No points, punitive language, rankings, or streaks.

---

# 20. Wellness Design

Feature 4D adds “Thể trạng” as a distinct lavender/soft-blue subsection inside sage Rèn luyện, not a health dashboard. Use cream rounded cards, natural Vietnamese, and compact current weight, optional target, recent signed change, and informational BMI. Show the latest measurement date and actual dates/counts for 7/30-day comparisons. Missing height/measurements have calm incomplete states, without fabricated estimates or health categories. Activity selection is optional and does not infer sensitive demographic inputs or energy estimates.

“Ghi cân nặng” and “Cập nhật thông tin” open labelled, feature-owned forms that close after saving and refresh the summary. Duplicate-day feedback guides the owner to edit the existing history entry. Deletion requires confirmation. Keep 44px touch targets, keyboard focus, wrapping titles/notes, and comfortable 320px/390px forms. Show seven recent dated observations initially, expandable to fourteen; a compact list is sufficient, with no synthetic chart points or heavy chart library.

Use neutral signs and text for weight changes, not red/green judgments or target scoring. BMI is a numeric reference only, with a brief non-medical disclaimer. No pressure to change weight, streaks, rankings, or wellness details on Home. PARENT never sees this workspace or another member's body data.

Wellness belongs to the individual user.

Charts should be calm and supportive.

Display:

weight trend;

current goal;

progress;

optional BMI.

Avoid aggressive warning colors simply because weight increased.

Use neutral informational language.

---

# 21. Fitness Design

Feature 4C uses cream surfaces with sage, lavender, and soft blue accents, activity/target icons, rounded cards, and Vietnamese labels. Rèn luyện is a distinct sibling of Học tập, not an administration dashboard. Show real weekly counts, optional goal progress, known minutes, and the next workout. Missing duration is “Chưa ghi thời lượng”, not a zero-minute workout; empty weeks say “Chưa có buổi tập nào trong tuần này”.

“Ghi buổi tập”, “Lịch tập”, and “Mục tiêu tuần” open compact owner-only forms. Successful saves close the form and refresh the summary. Deletions require confirmation and explain linked-record conflicts. Keep labelled controls and touch targets comfortable at 320px/390px; long titles and notes wrap. Use a lightweight accessible progress bar and a calm positive target-completed state, with no streaks or penalties.

Home uses two compact sibling Study/Fitness cards, each linking to Học & Luyện. Fitness shows only the signed-in member's weekly counts, target progress, and known minutes, never workout history, notes, or plan names. PARENT sees neither private card and no member switcher. Planned workouts do not appear in the family calendar.

Fitness should emphasize consistency.

Preferred visualizations:

weekly session progress;

completed workouts;

weekly goals.

Avoid encouraging unhealthy daily workout streaks.

---

# 22. Study Design

Feature 6A adds a calm “Chia sẻ” action on each assessment card. A focused cream sheet uses small family avatars, comfortable radio-label touch targets, explicit confirmation and plain Vietnamese privacy guidance. Show “Riêng tư” only after confirming no recipients, “Đã chia sẻ với …” for actual grants and “Ngừng chia sẻ” for revoke. Do not infer privacy state before loading. Preserve keyboard focus, Escape/backdrop dismissal and focus restoration, including after asynchronous changes. Never show technical ACL terms or source IDs.

Cá nhân contains “Được chia sẻ với bạn” for every role: warm lavender read-only cards with owner avatar/name, course/title, Vietnamese score/percentage/date and sharing attribution. No edit/delete/reshare controls. Empty/loading/error/retry and refresh states use real data only. Keep 320px/390px layouts and 44px targets; all other Study/Fitness/Wellness/private-expense data remains private, and Mom's Home does not gain grade cards.

Feature 4A uses “Học tập & Rèn luyện”, with peach/orange study cards on cream, books/target/clock icons, rounded surfaces, simple labelled progress bars, and natural Vietnamese. Show real totals or “Chưa có buổi học nào trong tuần này”; never sample courses or invented progress. “Ghi buổi học”, “Thêm mục tiêu”, and “Quản lý môn học” open compact feature-owned forms that close after successful saves. Explicit confirmation precedes deletion; linked-record errors explain how to unlink first.

Keep controls at least 44px and forms comfortable at 320px/390px. Course, semester, and goal names must wrap safely. Study is personal, not family-readable: no member switcher, family comparison, or parent overview. Home shows only the signed-in ADMIN/MEMBER's own weekly summary; PARENT receives no Study card. Feature 4B adds grades below, and Feature 4C provides the separate private Rèn luyện section described above.

Feature 4B adds a separate “Điểm & bài kiểm tra” entry with “Xem điểm”, opening a focused peach/lavender view. Use a course selector and rounded cards rather than a gradebook table. “Thêm điểm” and “Chỉnh sửa” forms collapse after saving; “Xóa” requires confirmation. Show numeric scores, derived percentages, optional letter/weight/date, and real course summaries with honest weighted coverage. Empty states say “Chưa có điểm nào” and explain that results appear when added. Keep low results neutral: no red alarms, judgmental labels, comparisons, or ranks. Home may show only the signed-in member's latest result subtly; Mom's Home shows no grade data; explicitly received results appear only in Cá nhân. No GPA or final-grade claim.

Study tracking should make progress easy to understand.

Useful cards:

This week's study time

Subject breakdown

Weekly goal

Recent sessions

Grade trend

Study visuals should use the same family design system rather than turning into a separate school dashboard.

---

# 23. Expense Design

Feature 5A uses cream rounded cards with sage totals, peach actions, and muted-blue category bars. Mom's Chi tiêu has keyboard-accessible Cá nhân and Tiền ăn gia đình tabs. Feature 5B makes the latter functional for all roles: PARENT manages, ADMIN/MEMBER only view. ADMIN/MEMBER's Cá nhân contains one clear “Mở chi tiêu cá nhân” entry; the full experience is a separate focused subview, with Cá nhân remaining highlighted in the five-item bottom navigation.

Use natural Vietnamese, a centralized exact VND formatter (“120.000 đ”), labelled month/date/category/note inputs, 44px controls, and layouts comfortable at 320px/390px. Add/edit forms collapse on success and switch to the saved record's month; deletion requires confirmation. Historical totals are labelled with their actual selected month rather than “Tháng này”. Recent rows are paginated; non-zero category bars and whole-month totals use real data only.

Comparisons are neutral “Tăng”/“Giảm”, never red/green spending judgments. Zero prior month explains that no percentage is calculated. Home has a compact own-only “Chi tiêu cá nhân tháng này” card, clearly separate from shared family food spending and without notes/history. Cá nhân is functional and must no longer carry a Sắp có badge; Tiền ăn gia đình is functional, not Sắp có. Shared food uses cream rounded item cards, peach breakfast, sage dinner and soft-yellow totals; item prices and exact meal totals are readable at 320/390px. All roles have keyboard-accessible private/shared tabs; personal totals are never merged with shared totals. Bếp costs are dated, read-only snapshots, with no management controls; management stays in Chi tiêu.

Financial data should remain calm and neutral.

Useful visualizations:

monthly total;

month-over-month difference;

category breakdown;

trend chart.

Avoid:

red = bad spending

green = good spending

unless there is a genuine system status.

Changes should normally be communicated neutrally.

---

# 24. Charts

Charts may be used for:

weight;

study hours;

expenses;

ratings;

fitness goals.

Chart design should be simple.

Do not overload dashboards with charts.

Each chart must answer a clear user question.

Examples:

"Is my weight trending down?"

"Did I study more this week?"

"Did I spend more this month?"

---

# 25. Animation

Animation should provide delight without slowing down normal usage.

Suitable animation:

- subtle card entrance;
- button feedback;
- progress animation;
- achievement celebration;
- page transitions;
- notification feedback.

Avoid:

- continuous decorative animation;
- excessive parallax;
- spinning backgrounds;
- heavy particle effects;
- constant glowing borders.

---

# 26. UI Technology Strategy

Base component foundation:

shadcn/ui

Use shadcn for common accessible primitives such as:

- buttons;
- dialogs;
- sheets;
- inputs;
- tabs;
- dropdowns;
- accordions;
- forms;
- tooltips.

---

## React Bits

React Bits may be used selectively for:

- progress animations;
- number animations;
- lightweight interactive effects;
- special cards.

Do not use components only because they look impressive.

They must match the family design language.

---

## Motion Primitives

Motion Primitives may be used selectively.

Suitable uses:

- subtle glow on an achievement;
- gentle interactive feedback;
- important celebration moments.

Avoid persistent neon-like visual effects.

---

## Uiverse

Uiverse may be used as inspiration for isolated components.

Any adopted component must be:

- restyled to match the design system;
- checked for accessibility;
- reviewed before inclusion.

Do not introduce a random visual style from Uiverse directly.

---

## 21st.dev

21st.dev may be used for design exploration and generating component concepts.

Generated designs are references.

They must be adapted to this project's design system.

---

## UI/UX Pro Max

UI/UX Pro Max may be used as a design and UX reasoning tool during implementation.

Its suggestions must still follow this project's established design direction.

---

## ThreeUI

ThreeUI is optional.

Use only where a richer visual interaction genuinely improves the experience.

Do not turn the application into a 3D showcase.

---

# 27. Component Consistency Rule

Never assemble the application by copying unrelated visual components directly from different libraries.

Every external component must be adapted to:

- project colors;
- typography;
- border radius;
- spacing;
- interaction behavior.

The final user should not be able to tell which library a component originally came from.

---

# 28. Accessibility

The application should support:

- keyboard navigation where relevant;
- visible focus states;
- appropriate contrast;
- meaningful button labels;
- semantic HTML;
- reasonable touch target sizes.

Recommended mobile touch target:

approximately 44px minimum.

Do not sacrifice usability for visual decoration.

---

# 29. Responsive Design

Primary target:

mobile phone.

Secondary target:

tablet.

Third target:

desktop.

Every core feature must remain usable on mobile before desktop polish is considered complete.

---

# 30. Design Review Rule

Before accepting a new page or component, ask:

Does this feel like the same family application?

Is it easy for Mom to understand?

Can it be comfortably used on a phone?

Is the important action obvious?

Is there unnecessary decoration?

Does it feel warm instead of corporate?

If the answers are not satisfactory, redesign before adding more features.
