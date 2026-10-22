# Family Life Hub — Product Specification

## 1. Product Overview

Family Life Hub is a private family-oriented web application designed to support everyday household life.

The project originally comes from a real family problem: Mom often needs to message the family group every day to ask what Kha and Bin want to eat, whether they have classes, who will wash the dishes, and other daily questions.

The goal of Family Life Hub is to reduce repeated family messages by providing one warm, simple, and easy-to-use place where family members can manage meals, schedules, chores, personal progress, study, fitness, and spending.

The application should feel warm, cozy, friendly, playful, and family-oriented rather than like a corporate dashboard.

The primary end-user UI language is Vietnamese.

Feature 6B makes Cá nhân the profile/settings destination: own display name and predefined avatar, current-PIN-confirmed PIN change, privacy explanation, existing received shares, assessment-sharing entry and role-specific shortcuts. Every successful PIN change/reset ends all target sessions and requires that member to sign in again. Only ADMIN may reset another active member's PIN, with their own current PIN and explicit target confirmation; technical recovery does not grant access to the target's private Study, Fitness, Wellness or spending data. No uploads, role editing, account deletion or module-wide sharing are included.

The mobile app shell is role-aware. PARENT uses Trang chủ, Bếp, Lịch, Chi tiêu, and Cá nhân. ADMIN/MEMBER uses Trang chủ, Bếp, Lịch, Học & Luyện, and Cá nhân; Feature 5A exposes private personal spending through Cá nhân, without a sixth bottom-navigation item. Bếp contains the implemented meal workflows. Features 4A–4C make Học tập, grades, and Rèn luyện functional and private, without invented records or progress. Notifications open from a header bell with a positive unread-count badge, rather than an always-expanded list.

Trang chủ is a compact “Hôm nay nhà mình có gì?” overview, not a second meal editor. Greeting and date use family time. PARENT sees family meal attention items; ADMIN/MEMBER sees only their own outstanding actions. It summarizes the next breakfast and today's dinner, with links to Bếp. Recent dishes show at most three ready dinner dish instances ordered by served date (then dish order); PARENT sees rated dishes with family average/count, while ADMIN/MEMBER also sees unrated dishes and their own score. Individual feedback from other members is not exposed here. Future-module cards contain no fake schedules, money, goals, or private-module data.

The initial family consists of:

- Kha / Tun Tun
- Mom
- Bin Bin

The system should be designed so that more family members can be added later.

---

## 2. Product Principles

The application should follow these principles:

1. Family-first and easy to use.
2. Mobile-first because family members will often use it from their phones.
3. Warm and friendly instead of technical or corporate.
4. Personal data should remain private unless the owner chooses to share it.
5. Technical administrators must not automatically gain access to private personal information.
6. The system should reduce work for Mom rather than create additional work.
7. Features should reflect the family's real daily habits instead of forcing every workflow into the same structure.
8. The application should be implemented incrementally in small, testable features.
9. Every completed development feature should have a meaningful Git commit.
10. The architecture must remain clean and scalable even though the initial user base is small.

---

# 3. Authentication and Family Accounts

## 3.1 Account Creation

There is no public registration.

Initial family accounts are created in advance by the system administrator.

The initial accounts are:

- Kha
- Mom
- Bin

More members may be added later by the administrator.

---

## 3.2 Login Experience

Users do not need to type an email address.

The login screen displays family profiles.

Example:

Who is using Family Life Hub?

- Mom
- Tun Tun
- Bin Bin

The user selects their profile and enters a 6-digit PIN.

Initial PINs may be set using each member's birthday in DDMMYY format.

Example:

03 February 2005:

030205

Each member can later change their PIN.

PINs must never be stored as plain text.

---

## 3.3 Personal Profile

Each member can manage their own profile.

Users may:

- change their display name;
- change their avatar;
- choose a preset avatar;
- upload a custom avatar later if supported;
- change their PIN;
- manage personal preferences.

Users may only edit their own personal profile unless an explicit administrative function exists.

---

# 4. Roles and Permissions

## 4.1 ADMIN — Kha

Kha is the technical administrator and is also a normal family member.

Kha can:

- manage family accounts;
- create or disable family members;
- reset another member's PIN;
- manage system-level configuration;
- manage the default breakfast dish catalog;
- select meals for himself;
- mark "not eating";
- submit custom meal requests;
- rate dishes prepared by Mom;
- comment on dishes;
- view dishwashing schedules;
- manage his own timetable;
- view other family members' timetables;
- manage his own wellness information;
- manage his own fitness information;
- manage his own study information;
- manage his own personal expenses.

ADMIN does not automatically gain access to private wellness, study, grades, or personal expense information belonging to another user.

Kha must not be able to edit Bin's timetable simply because he is ADMIN.

---

## 4.2 PARENT — Mom

Mom is the main household meal and chore coordinator.

Mom can:

- manage her own profile;
- view meal selections submitted by Kha and Bin;
- create lunch and dinner meal requests;
- create meal polls;
- finalize the dishes that will be prepared;
- mark breakfast as purchased;
- mark lunch or dinner as ready;
- add optional messages to meal updates;
- send household meal notifications;
- view ratings and comments about dishes she prepared;
- create and edit the dishwashing schedule;
- view everyone's timetable;
- record household food expenses;
- view household food spending statistics.

Mom does not need to:

- choose meals for herself;
- submit meal preferences;
- rate her own cooking;
- edit Kha's timetable;
- edit Bin's timetable;
- manage technical user accounts.

---

## 4.3 MEMBER — Bin

Bin is a normal family member.

Bin can:

- manage his own profile;
- select breakfast meals;
- select lunch or dinner options;
- submit a custom meal request;
- mark "not eating";
- rate individual dishes;
- leave comments about dishes;
- view the dishwashing schedule;
- view everyone's timetable;
- create and edit his own timetable;
- duplicate his weekly timetable;
- track his own wellness;
- track his own fitness;
- track his own study activity;
- track his own grades;
- track his own personal spending.

Bin cannot edit another person's timetable.

---

# 5. Meal System

Meals are divided into three meal types:

- Breakfast
- Lunch
- Dinner

These are meal categories and are not automatically determined by clock time.

For example, the family may eat dinner at 16:00, 17:00, or 18:00, but it is still considered Dinner.

---

# 6. Breakfast Workflow

Breakfast follows a recurring daily workflow.

Mom should not need to create a breakfast form manually every day.

The system automatically makes the next day's breakfast selection available.

Kha and Bin independently select what they want for breakfast.

For breakfast date D, selection opens at D-1 18:00 and hard-locks at D 01:00, in family time (`Asia/Ho_Chi_Minh`). The same breakfast stays active across midnight and through its morning/day; the next cycle becomes active at the next 18:00 boundary. Before opening there is no editable chooser. After locking, responses are final; NO_RESPONSE remains absence, with calm “mẹ mua gì ăn đó” meaning and no penalty.

The purpose of the deadline is so Mom can check the selections in the morning and know what food to buy.

---

## 6.1 Initial Breakfast Dish Catalog

The initial breakfast options are:

- Cơm tấm
- Bún chả
- Miến gà
- Bún thịt nướng
- Phở
- Bún riêu
- Bún bò
- Bánh cuốn
- Bánh mì
- Trứng ốp la + bánh mì sandwich + thịt nguội + xúc xích
- Mì gói
- Bánh canh cua

The system must also provide:

- Other / Custom option
- Not eating

When selecting Other, the user can type a custom breakfast choice.

The breakfast catalog can be expanded later.

---

## 6.2 Breakfast States

The following states must be clearly different:

Not answered

and

Not eating

If a user has not answered, Mom should know that the user has not responded yet.

If a user explicitly selects Not eating, Mom should know that she does not need to buy breakfast for that user.

---

## 6.3 Breakfast Purchased

After Mom buys breakfast, she can press a quick action:

"Breakfast purchased"

Mom may optionally attach a message.

After purchase, member and parent active cards collapse to a compact purchased summary/message instead of retaining the old chooser or response-management controls. History remains stored. Mom may still edit the message without creating a duplicate event.

Example:

"Nước cam trong tủ lạnh nha hai đứa."

Kha and Bin should receive an in-app notification and, when supported, a push notification.

---

# 7. Daily Dinner Requests

Feature 2G limits the active Bếp flow to the next breakfast and the current recurring dinner cycle, interpreted in `Asia/Ho_Chi_Minh`. The family normally skips lunch. Lunch schema and historical data remain intact, but no lunch controls, arbitrary date pickers, future planning or history lists appear in the normal kitchen experience.

Correction Batch C1 makes dinner recurring and system-driven. The backend ensures one basic question for dinner date D from D−1 18:00 through D 01:00 family time: “Tối mai tụi con muốn ăn gì?”. Mom may add or edit an optional “Gợi ý / lời nhắn của mẹ”; she does not create a new daily request. Kha and Bin answer independently with free text, may change their own answers before 01:00, and receive no punishment for NO_RESPONSE. Existing legacy polls, self-service rows, and historical responses remain compatible but are not the normal new dinner UI.

---

## 7.1 Open Choice Request

Mom may ask:

"What do you want to eat tonight?"

Kha and Bin can independently type a desired dish.

Example:

Kha:
Canh chua cá

Bin:
Gà chiên nước mắm

Mom can review both requests before deciding the final meal.

---

## 7.2 Legacy Option Poll (read compatibility only)

New dinner requests use free-text OPEN_CHOICE only. Existing poll/options/selected responses are retained and safely readable. Active legacy dinner polls also accept free-text replies; editing message/deadline alone preserves their mode/options/responses. The following describes historical poll data, not a new user-facing flow.

Example:

Mom already has chicken.

Available choices:

- Gà chiên nước mắm
- Gà kho gừng
- Gà nướng
- Not eating

Kha and Bin select from the provided options.

---

# 8. Meal Request Deadline

The recurring dinner response window is fixed: it opens at D−1 18:00 and closes at D 01:00 in family time. Technical APIs remain date-capable for compatibility; the normal UI does not expose arbitrary dinner dates or editable deadlines. Response creation and updates lock at the exact cutoff on the backend and in the active UI. Replies are free text, including explicit “Hôm nay con không ăn tối”; recognized explicit no-dinner phrases become NOT_EATING and never cooked-dish candidates. Other free-text replies themselves may be candidates; no NLP or AI parsing is introduced.

---

# 9. Mom Is Not Cooking

There may be days where Mom is away or does not plan to cook.

Instead of leaving the state ambiguous, Mom can use a quick status:

"Everyone handle this meal yourselves"

An optional message can be included.

Example:

"Mom is going out today. Tun can order food for you two."

This should notify Kha and Bin.

Mom may choose **Chỉnh sửa** on today's plan to edit its deadline and message. A separate **Chuyển sang tự túc** action retains confirmation before discarding incompatible responses; metadata-only edits preserve existing replies, including legacy poll data. **Đổi kế hoạch** on self-service returns to a simple free-text question. **Xóa kế hoạch** asks for confirmation and hides the plan from the active kitchen while retaining a CANCELLED record internally. It blocks further responses and updates its existing notification to non-actionable wording without resetting read state. The slot can be used again; discarding incompatible old responses on recreation also requires explicit confirmation. Deadline expiry is not cancellation.

---

# 10. Final Meal

Mom is responsible for confirming what was actually prepared.

An active PARENT confirms today's dinner primarily from the children's responses: selected poll labels and open-choice texts become unique candidate dishes, normalized for Unicode, case and whitespace. A shared choice is shown once with the children who chose it. NOT_EATING and NO_RESPONSE never become candidates. Mom selects candidates without retyping them and may use the secondary **Thêm món khác** escape hatch. Categories use defaults and are optional advanced controls for extra dishes. Each slot still has at most one final meal; technical date-capable lunch/dinner APIs remain compatible. Saving dishes leaves family responses unchanged. Self-service must first change through **Chỉnh sửa**. ADMIN/MEMBER cannot edit the cooked dishes.

A meal can contain multiple dishes.

Example Dinner:

- Gà chiên nước mắm
- Thịt kho
- Canh chua

The system must not assume that one meal only contains one dish.

If Kha and Bin request different main dishes, Mom may prepare smaller portions of both.

There is no requirement for the application to calculate exact portion percentages.

---

## 10.1 Dish Categories

Final meal dishes may have categories such as:

- Main dish
- Soup
- Side dish
- Vegetable
- Other

Categories help future statistics and ratings.

---

# 11. Meal Ready Status

After Mom finishes cooking lunch or dinner, she can press:

"Meal ready"

This sends a notification to family members.

Mom can optionally add a message.

Example:

"Thịt ở trong nồi chiên không dầu."

If no custom message is provided, a simple default message should be sent.

The implemented action is **Bữa ăn đã sẵn sàng**. Retrying it retains the first ready time and reuses each recipient's notification. Once ready, dish composition is locked server-side: no add/remove/rename/reorder, while Mom can still edit the ready message. Existing ratings remain attached to immutable served dishes. Parents and inactive members do not receive meal-ready notifications.

---

# 12. Dish Ratings

Ratings are applied to individual dishes rather than the entire meal.

Example:

Dinner:

Gà chiên nước mắm:
5 stars

Canh chua:
3 stars

This allows feedback to remain meaningful.

Kha and Bin may:

- rate dishes from 1 to 5 stars;
- leave an optional text comment.

Example:

"Cơm hôm nay hơi nhiều, lần sau nấu ít hơn nha mẹ."

Mom can read all ratings and comments for dishes she prepared.

Feature 2E allows active ADMIN/MEMBER profiles to rate individual dish instances only after the final meal is ready. Each dish is optional: one integer 1–5 score and an optional trimmed comment up to 300 characters, editable by its author. Members see only their own feedback; PARENT sees named feedback grouped by dish and has no rating controls. Saved forms collapse into stars/comment with **Chỉnh sửa đánh giá**; unrated dishes offer **Đánh giá món**. Ratings do not apply to generic catalog dish names.

Before ready, edits preserve retained dish identities; removing a dish explicitly removes that instance. After ready, composition cannot change. Technical IDs remain internal. The main kitchen shows only **Đánh giá bữa tối** for members or **Xem góp ý bữa ăn** for Mom. These open a focused, dismissible sheet; per-dish forms and named feedback are not expanded inline in Bếp.

---

# 13. Meal Analytics and Gamification

The system may calculate positive statistics such as:

- average dish rating;
- highest-rated dish;
- most frequently selected dish;
- most popular dish this month.

Possible positive achievements include:

- Five-Star Chef
- Family Favorite Dish
- Loyal Customer
- Helpful Reviewer
- Meal Response Streak

Gamification should remain positive and playful.

The system should not create negative or embarrassing awards.

---

# 14. Timetable

Lịch has two explicit products. **Lịch nhà** (FAMILY) is visible to every active family member; every member, including PARENT, creates/edits/deletes only their own events. **Lịch của tôi** (PERSONAL) is available only to ADMIN/MEMBER and is readable/mutable only by its owner; neither a sibling, PARENT nor ADMIN has a privacy bypass. PARENT has only Lịch nhà. School/on-campus availability and genuinely shared commitments belong in Lịch nhà; self-study, workouts and personal goals belong in Lịch của tôi. No automatic Study/Fitness calendar generation is introduced.

The calendar supports one-time events and same-day weekly schedules with selected weekdays, a start date, and optional inclusive end date. A single recurring occurrence can be cancelled or given its own title, times, and note without changing the series. Cancelled occurrences remain visibly marked; moved occurrences appear in their destination date range. Whole-series schedule changes are refused once exceptions exist, to avoid silently invalidating those changes; edit individual occurrences instead. Deleting an owned series explicitly removes its exceptions.

Lịch defaults to a day time-axis grid with positioned event blocks, a horizontally scrollable mobile week grid, date navigation, and stable member-color identity in FAMILY. PERSONAL uses category colors. “Nhân bản tuần” copies only the actor's FAMILY occurrences into the following week, includes explicit confirmation, skips recurring occurrences already present, and deduplicates retries. It never copies another member's or personal events. Existing child-owned legacy events migrate to PERSONAL conservatively; an explicit owner edit may publish them to FAMILY. PARENT legacy events remain FAMILY, including retained inactive-parent history, which stays hidden until reactivation. Home shows up to three current/upcoming FAMILY events for everyone and a separate own PERSONAL summary only for ADMIN/MEMBER.

The following academic timetable features remain future work. Each student member will be able to maintain their own university timetable.

Everyone in the family can view everyone's timetable.

Only the timetable owner can modify their own schedule.

Example:

Kha timetable:
- Kha can edit
- Bin can view
- Mom can view

Bin timetable:
- Bin can edit
- Kha can view
- Mom can view

ADMIN status does not override timetable ownership.

---

## 14.1 Semester Structure

Timetables should belong to an academic semester.

Example:

Semester 1 — 2027

Inside a semester, a user can create subjects and weekly classes.

---

## 14.2 Weekly Timetable

Users can:

- create classes;
- edit classes;
- delete classes;
- duplicate one week's timetable into another week;
- modify individual classes after duplication;
- mark a class as cancelled;
- support schedule changes between weeks.

This is important because university schedules can change.

---

# 15. Family Chores (Feature 3C)

The active household schedule is one combined **“Rửa chén & Đổ rác”** duty per family date. Only PARENT assigns an active member (including self), edits/reassigns a pending date, cancels it, or duplicates a saved week into the next week. ADMIN has no management bypass. All active members view daily/weekly assignments. Only the assignee may confirm **today's** uncancelled duty; past/future completion and completion on another member's behalf are refused.

Missing assignments are not completion. Completion retains assignee, completed-by identity and server time, is idempotent, and cannot later be cancelled or reassigned. Each completion notifies the active scheduling PARENT once using the existing in-app notification subsystem; retries preserve read state. There is no realtime/push or gamification.

The seven-day editor saves explicit dated assignments atomically. Week duplication copies non-cancelled saved assignments, not completion status; an identical target is a no-op and a conflicting target is never overwritten. Legacy generic chore schedules/occurrences and their historical notifications remain retained in the legacy API, not destructively merged into the new duty model or displayed as new combined assignments.

Lịch keeps “Việc nhà hôm nay” / “Việc nhà trong tuần” separate from event blocks. PARENT uses “Quản lý việc nhà”, “Lưu tuần” and confirmed “Nhân bản tuần việc nhà”. Assignees see “Hôm nay tới phiên bạn”, “Hoàn thành việc nhà ✓”, then a compact “Đã hoàn thành ✓” state with completion time.

Home shows today's non-cancelled combined duty: assignee/status for PARENT and own assignment/completion action for ADMIN/MEMBER. It never duplicates management forms or exposes private child-calendar data to Mom.

Legacy assignment notices keep their existing behavior. Combined-duty completion uses one notification per scheduling parent and duty identity; unrelated notices are untouched.

---

# 16. Notifications

The application should support two levels of notifications.

## 16.1 In-App Notifications

Notifications are saved in the database.

Examples:

- Breakfast purchased
- Meal request created
- Meal deadline approaching
- Meal ready
- Mom is not cooking
- Dishwashing update

Users can see unread notifications inside the application.

---

## 16.2 Push Notifications

When supported, the PWA may send push notifications to the user's phone.

Examples:

"Mom: Cơm xong rồi nha."

"Breakfast selection closes in one hour."

Push notifications should complement in-app notifications, not replace them.

---

# 17. PWA

Family Life Hub should be designed as an installable Progressive Web App.

The application should:

- work as a responsive web application;
- be installable on supported phones;
- have an application icon;
- support Add to Home Screen;
- support service-worker-based functionality where useful;
- support push notifications when implemented;
- use a mobile-first interface.

The application should still function as a normal website if the user does not install the PWA.

---

# 18. Wellness

## Implemented private foundation (Feature 4D)

Thể trạng is an optional, separate subsection within Rèn luyện for active ADMIN/MEMBER. Each owner alone manages their profile and measurements; ADMIN has no privacy bypass. PARENT has no Wellness workspace or API access. Sharing is not implemented. No Wellness data is queried or returned by Home, including for the owner. Fitness goals never change automatically with body weight, and nothing is synchronized to the family calendar.

The profile stores optional height (100–250 cm), optional target weight (20–350 kg), and an optional explicitly selected activity level. Height/weight values accept up to two decimal places. These are input bounds, not health recommendations. Empty optional fields clear previously stored values; resetting the profile does not delete measurement history. No age, birthday, or biological sex is collected or inferred.

Each completed weight log has a family-local date (2000–2199, not future), weight (20–350 kg), and optional trimmed note up to 1000 characters. One entry per owner/date is enforced; duplicates are rejected with guidance to edit the existing entry, never silently overwritten. Owners can edit/delete their own entries, with explicit deletion confirmation. Forms close after successful saves and refresh real summaries.

Current weight is the latest dated measurement, with its date shown; previous weight is the preceding dated measurement. Recent change is current minus previous, rounded to two decimal places. A 7/30-day trend uses today's family-local date and the previous 6/29 dates, comparing the earliest and latest actual observations within that window. At least two observations are required. Display actual comparison dates and point counts; never interpolate missing days or imply a full seven/thirty-day change from sparse observations.

BMI is weight in kg divided by squared height in meters, rounded to one decimal place, only when both measurements exist. It is informational, without categories, diagnosis, recommendations, warning colors, or scoring. Missing inputs show a calm incomplete state. BMR/TDEE are deliberately omitted in Feature 4D because required age/biological-sex inputs do not safely exist; activity level is stored only as the owner's optional selection and does not produce calorie estimates.

The compact history initially shows seven of the latest fourteen observations. Backend calculation reads at most 31 latest daily entries: uniqueness per date guarantees that all possible observations in the 30-day window are included. No derived BMI, change, or trend is stored. No photos, wearable sync, wellness notifications, streaks, gamification, or medical advice are introduced.

## Longer-term direction

Each family member may choose to use personal wellness tracking.

This module is optional.

Users can record:

- height;
- body weight;
- weight goal;
- daily weight entries.

The system should display progress graphs.

Example:

19/10:
88.4 kg

20/10:
88.0 kg

21/10:
87.8 kg

The purpose is to help users observe long-term progress and stay motivated.

---

## 18.1 BMI and Calories

For adult users, the system may calculate:

- BMI;
- estimated BMR;
- estimated maintenance calories / TDEE.

These values should be presented as estimates rather than strict medical instructions.

Bin is currently an adult and may use this feature.

---

# 19. Fitness Tracking

## Implemented private foundation (Feature 4C)

Fitness is private to each active ADMIN/MEMBER. PARENT has no Fitness workspace or API access; ADMIN cannot read or change another member's records. Sharing is not implemented.

Each owner manages workout plans, weekly plan days, completed sessions, and a weekly session goal. At most one plan and one goal are active per owner. A plan has at most one workout per ISO weekday (Monday–Sunday). A session may optionally reference an owned plan day; its title and note remain independent snapshots. Sessions use a family-local completed date, optional 1–1440 minute duration, and optional note. Future completed dates are rejected. Referenced plans/days cannot be deleted silently: unlink or delete dependent records first.

Weekly progress counts all completed sessions in the current family-local Monday–Sunday week. The active target is 1–21 sessions; no goal means no invented target or percentage. Percentages are rounded and capped at 100%, with a calm completed state and no penalties. Total minutes include only recorded durations; unknown durations are explicitly identified, not presented as zero-length workouts. Recent history is capped at 20 sessions, initially showing five, independently of weekly totals.

The next workout comes from the active weekly plan, beginning today; a plan day already linked to a completed session on that date is skipped. Free workouts do not automatically complete a scheduled day. Workout days do not create family-visible calendar events. There are no Fitness notifications, exercise programming, wellness metrics, or sharing.

Học & Luyện keeps Study and grades functional and replaces the Rèn luyện placeholder with warm private plan, goal, and session forms. Forms collapse after saving and refresh real summaries. ADMIN/MEMBER Home shows compact sibling Study and Fitness cards; Fitness contains only own weekly counts, goal progress, and known minutes, not plan names, session history, or notes. PARENT Home neither queries nor returns Fitness data.

Fitness tracking should remain simple.

Version 1 may support:

- workout plan;
- planned workout days;
- workout completed status;
- workout duration;
- workout notes;
- weekly exercise goals.

Example:

Weekly goal:
3 workouts

Progress:
2 / 3 completed

The system should encourage healthy consistency rather than requiring exercise every day.

Possible future expansion:

- exercises;
- sets;
- reps;
- weight used.

The database should be designed so that this expansion remains possible later.

---

# 20. Study Tracking

## Implemented foundation (Feature 4A)

Active ADMIN/MEMBER each manage only their own semesters, courses, goals, and study sessions. ADMIN never bypasses ownership. PARENT has no Study workspace or access to member Study data in this feature. Feature 6A supports only explicit per-assessment sharing through separate APIs; these workspace APIs remain owner-only.

Semesters have inclusive start/end dates and at most one active semester per owner. Courses belong to one semester of the same owner. Goals and sessions may optionally reference a course of the same owner; a course is not required to record self-study. Deletion of a referenced semester/course is refused rather than silently deleting learning history; unlink or delete dependent records explicitly first.

Sessions record a family-local study date, 1–1440 minutes, and an optional note. Future sessions cannot be logged. “Ghi buổi học” closes after a successful save, then refreshes totals and recent sessions. Goals support text, optional course, optional target minutes/date, and explicit ACTIVE/COMPLETED state. There is no automatic goal completion, negative scoring, or gamification.

The current week is Monday–Sunday in the family timezone. Weekly totals and course breakdown include all sessions in that week, independently of the recent-list limit of 50. An ACTIVE goal's time progress uses this week's minutes for its course, or all courses when unlinked; text-only goals are completed manually. Targets remain active until the owner changes their status; target dates are informational, not automatic expiry.

Học & Luyện provides a peach/orange Học tập section with real weekly totals, goals, courses, recent sessions, and management forms, beside the private Rèn luyện foundation from Feature 4C. ADMIN/MEMBER Home displays only their own study time and active goal progress with “Xem Học & Luyện”. PARENT Home neither queries nor returns course names, goals, sessions, or study durations. No Study notifications or calendar auto-sync are introduced. Feature 4B adds private assessments below; cross-week analytics remain future work; Feature 6A adds separate per-assessment sharing.

The following examples describe the longer-term Study direction, not additional Feature 4A capabilities.

Each member can independently track their own study activity.

Study data belongs to the owner by default.

Users can create:

- semesters;
- courses / subjects;
- weekly study goals;
- study sessions.

Example:

Subject:
Cyber Security

Duration:
2 hours

Note:
Reviewed networking material.

The system should calculate weekly statistics.

Example:

Cyber Security:
4h 20m

Programming:
2h 10m

Total:
6h 30m

Progress charts may compare study time between weeks.

---

# 21. Grades

## Implemented private assessments (Feature 4B)

Active ADMIN/MEMBER manage only their own course assessments; ADMIN has no privacy bypass and PARENT has no private grade workspace/API access. Feature 6A adds only explicit, read-only per-assessment sharing through dedicated share APIs, not access to the Study workspace. An assessment must reference a course of the same owner. Course deletion is refused while assessments reference it, preventing silent loss of grade history.

Types: QUIZ, ASSIGNMENT, MIDTERM, FINAL, PROJECT, PRESENTATION, OTHER. Title is trimmed/nonblank (up to 160 characters); optional letter grade is up to 20 characters and optional note up to 1000. Numeric values allow up to four decimal places. Score is 0–1,000,000 and cannot exceed a positive maximum (up to 1,000,000). An unscored assessment may retain a positive maximum; letter-only or pending assessments are allowed. Optional weight is 0–100%; optional assessment date is a valid family-local date (2000–2199), including future planned dates.

Percentage is derived, never stored. A course's simple average is the arithmetic mean of its numeric assessment percentages, not pooled points; missing scores and letter grades are not converted. Weighted earned percentage points are the sum of `(score / max_score) × weight_percent`, using only rows with numeric score and weight. Display the corresponding scored weight coverage explicitly, without normalizing partial coverage into a final grade. Zero coverage yields no weighted result; coverage below 100% is incomplete, and above 100% is flagged with the weighted result withheld. Even 100% refers only to recorded weights, not an official final grade. Percentages/averages/earned points round to two decimal places for display; coverage retains four-decimal precision so incomplete coverage is not presented as 100%.

“Điểm & bài kiểm tra” is a separate calm Study area opened by “Xem điểm”. It supports course filtering, real course summaries, add/edit forms that close after saving, confirmed deletion, and friendly empty/error states. Home may show the signed-in ADMIN/MEMBER's latest assessment result, projected without notes or grade history. PARENT `/api/home` omits Study and all grade data entirely. No GPA, ranking, grade-based gamification, sharing, calendar sync, or notifications are added.

Users may record university assessment results.

Example:

Subject:
New Technologies

Assessment:
Midterm

Score:
8.5 / 10

The system should support different grading formats where possible, including:

- numeric score;
- maximum score;
- percentage;
- optional letter grade.

Users should be able to view their own academic progress over time.

---

# 22. Privacy and Sharing

## Implemented record-level sharing (Feature 6A)

All private modules remain private by default. An active ADMIN/MEMBER may explicitly share one owned STUDY_ASSESSMENT with another active family member of any role, including PARENT. Neither role bypasses ownership. Sharing is idempotent per owner/recipient/resource; recipients cannot reshare, edit, delete or comment. An owner may revoke at any time; the next recipient request/refresh loses access. Deleting an assessment cascades only its shares, leaving unrelated shares intact. Inactive owners/recipients cannot expose or read shared records.

Dedicated shared reads expose only the owner's display name/avatar, course name, assessment title/type, score/maximum, derived percentage, optional letter grade, assessment date and share timestamp. No private note, weight, course ID/metadata, other grades, sessions or goals is included. A share ID identifies the UI card; source IDs are not returned to recipients. The projection reflects current source values, not a frozen snapshot.

Học & Luyện → Điểm & bài kiểm tra provides “Chia sẻ” on each owned result. A focused sheet lists eligible active recipients, requires deliberate selection/confirmation, shows “Đã chia sẻ với …” and allows “Ngừng chia sẻ”. All roles find their read-only received results in Cá nhân → “Được chia sẻ với bạn”, with refresh and bounded pagination. No child grade appears on Mom's Home. No module-wide, Wellness, Fitness or personal-expense sharing, public links, notifications or permission inheritance is enabled. Module-wide privacy settings remain future work.

Personal information is private by default.

This applies especially to:

- wellness;
- fitness;
- study;
- grades;
- personal expenses.

Users may choose to share information.

The privacy model should support:

1. Module-level default visibility.
2. Individual-record visibility overrides.

Example:

Study module:
Private by default.

A specific midterm result:
Shared with Mom.

ADMIN does not automatically bypass personal-data privacy.

---

# 23. Family Food Spending (Feature 5B)

Tiền ăn gia đình is shared food spending, strictly separate from personal expenses. All active members may read meal dates, item names/prices, meal totals and monthly comparisons. Only PARENT may create, edit or delete with confirmation; ADMIN has no management bypass. BREAKFAST and DINNER only; no lunch, groceries category, budgets, splitting or notifications.

Each date/meal type has at most one entry with 1–30 editable items, optional note, completed family-local date and exact whole-VND amounts (1–1,000,000,000 per item). Totals derive from items. Existing finalized dinner names and selected/custom breakfast labels may assist entry, but prices are never guessed. Names are independent historical snapshots, so changing meal wording does not alter costs.

All roles have Cá nhân and Tiền ăn gia đình tabs in Chi tiêu. PARENT enters through Chi tiêu navigation; others through Cá nhân, without a sixth bottom-nav item. Personal records remain editable only by their owner. Shared food is read-only for ADMIN/MEMBER. Saving collapses the form; editing/deleting updates totals. Empty/error states never invent data.

Monthly current/previous totals, exact signed difference and breakfast/dinner breakdown cover all records, independently of recent-meal pagination (20 per page). Percentages are omitted for zero prior month or unrepresentable ratios. Home shows a separate compact shared monthly card, never combined with own personal spending. Bếp shows read-only dated item prices and meal totals for today's breakfast/dinner; management remains in Chi tiêu.

---

# 24. Personal Expense Tracking

## Implemented foundation (Feature 5A)

Every active family member, including PARENT, manages only their own personal expenses. Neither ADMIN nor PARENT bypasses ownership. No sharing exists. Household food spending is a separate shared domain (Feature 5B), not a personal-expense category or authorization exception.

PARENT's Chi tiêu workspace has functional Cá nhân and Tiền ăn gia đình tabs. ADMIN/MEMBER open Chi tiêu from Cá nhân, edit only their own personal records and view shared food costs read-only, keeping the approved five-item bottom navigation. Home may show only the signed-in member's own compact current-month total/comparison, clearly labelled personal; no notes, records, category detail, or other members' spending are returned there.

Expenses store positive whole VND, from 1 to 1,000,000,000 đồng per record. The API uses canonical integer strings, storage uses bigint, and monetary sums/differences use exact integer arithmetic, never floating-point money. Dates are completed family-local dates from 2000–2199, not future; notes are optional, trimmed, and limited to 1000 characters. Categories are FOOD, TRANSPORT, SHOPPING, ENTERTAINMENT, STUDY, FITNESS, BILLS, OTHER. They describe personal spending only.

Owners can add/edit/delete with confirmation and filter by calendar month. Saving closes the form, selects the saved record's month, and refreshes totals. Recent records use 20-row pages; whole-month totals/category breakdown do not depend on the page. Comparisons use the preceding calendar month, including January rollover. Signed difference is exact; percentage is rounded to one decimal using integer ratio arithmetic. A zero prior total produces no percentage; an unrepresentably large ratio is also omitted rather than becoming infinite. Categories show actual non-zero totals only, with neutral wording rather than overspending judgments.

Feature 5A creates no shared schema; Feature 5B implements that separate shared domain. Budgets, recurring bills, conversion, bank sync, OCR, expense notifications and gamification remain out of scope.

## Longer-term direction

Each member may privately track their own personal expenses.

Personal expense data is private by default.

Even ADMIN must not automatically see another user's spending.

Users can record:

- date;
- amount;
- category;
- note.

Possible categories:

- Food
- Transport
- Shopping
- Entertainment
- Education
- Bills
- Other

---

## 24.1 Personal Spending Analytics

Each user can view:

- spending this month;
- spending last month;
- difference;
- percentage change;
- spending by category;
- charts showing spending trends.

This feature is intended for self-evaluation.

It should not compare family members against each other.

---

# 25. Gamification

Gamification should add personality and motivation across the application.

Possible achievements include:

Meals:
- Five-Star Chef
- Family Favorite Dish
- Loyal Customer
- Helpful Reviewer

Fitness:
- Weekly Goal Completed
- Consistency Streak

Study:
- Study Goal Completed
- Focus Streak
- Study Hours Milestone

Wellness:
- Consistent Tracker
- Goal Progress

Achievements should always be positive.

Avoid public rankings involving:

- body weight;
- grades;
- personal spending;
- other sensitive personal data.

---

# 26. Personalized Dashboard

Each role should receive a dashboard relevant to that user.

Example Kha dashboard:

- breakfast selection;
- today's classes;
- dishwashing schedule;
- study hours this week;
- workout progress;
- weight trend;
- notifications.

Example Mom dashboard:

- Kha's breakfast choice;
- Bin's breakfast choice;
- active lunch or dinner requests;
- current dishwashing assignment;
- family timetable summary;
- household food spending;
- ratings on recent dishes.

---

# 27. Technical Direction

Frontend:

React + Vite + TypeScript

Backend:

Node.js + Express + TypeScript

Database:

Supabase PostgreSQL

Application style:

Progressive Web App

Production hosting target:

Vercel

Source control:

GitHub

The frontend and backend should remain clearly separated inside the repository.

---

# 28. Repository Philosophy

The project should use a clean monorepository-style structure.

Planned root structure:

frontend/
backend/
database/
docs/
postman/

The architecture should follow clear responsibility boundaries.

Backend business logic should not be placed directly inside route handlers.

Expected backend layers include:

- routes;
- controllers;
- services;
- repositories;
- middleware;
- validation;
- configuration.

---

# 29. Development Workflow

The application must be developed incrementally.

For every feature:

1. Define the feature scope.
2. Give Codex a focused implementation task.
3. Codex implements only that scope.
4. Run automated tests, lint, and build checks.
5. Review the changed code.
6. Manually test the feature.
7. Inspect git status and diff.
8. Create one meaningful commit.
9. Push only after review.
10. Continue to the next feature.

Codex must not commit or push automatically unless explicitly approved.

Avoid large commits containing unrelated functionality.

---

# 30. Planned Development Phases

Phase 1:
Project foundation, authentication, profiles, and roles.

Phase 2:
Meal system, breakfast, lunch/dinner requests, ratings, and notifications.

Phase 3:
Timetable.

Phase 4:
Dishwashing chores.

Phase 5:
Wellness and fitness.

Phase 6:
Study and grades.

Phase 7:
Household and personal expenses.

Phase 8:
Gamification, analytics, PWA polish, and UI refinement.

The final implementation order may change when necessary, but each phase should still be implemented through small, meaningful features.

---

# 31. Future Expansion

The product specification is intentionally extensible.

Future ideas may be added when real family needs appear.

Potential future features include:

- more family members;
- richer workout tracking;
- advanced meal analytics;
- AI-assisted features;
- shared family calendar;
- grocery lists;
- recurring household tasks;
- richer notification preferences.

New features should only be added when they solve a real family need or meaningfully improve the experience.
