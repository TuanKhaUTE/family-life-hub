# Family Life Hub — Product Specification

## 1. Product Overview

Family Life Hub is a private family-oriented web application designed to support everyday household life.

The project originally comes from a real family problem: Mom often needs to message the family group every day to ask what Kha and Bin want to eat, whether they have classes, who will wash the dishes, and other daily questions.

The goal of Family Life Hub is to reduce repeated family messages by providing one warm, simple, and easy-to-use place where family members can manage meals, schedules, chores, personal progress, study, fitness, and spending.

The application should feel warm, cozy, friendly, playful, and family-oriented rather than like a corporate dashboard.

The primary end-user UI language is Vietnamese.

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

Breakfast selection has a daily deadline of:

00:00

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

Example:

"Nước cam trong tủ lạnh nha hai đứa."

Kha and Bin should receive an in-app notification and, when supported, a push notification.

---

# 7. Lunch and Dinner Meal Requests

Lunch and dinner behave differently from breakfast.

Mom decides whether a lunch or dinner request is needed.

If no request is necessary, the system should not automatically create one.

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

## 7.2 Option Poll

If Mom already has ingredients available, she may create a poll.

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

Lunch and dinner requests support deadlines.

Suggested presets:

- 12:00 today
- 3 hours after creation
- Custom time

If Mom creates a request in the morning, 12:00 is a useful default because she may need the responses before going to the market.

The deadline must remain configurable.

---

# 9. Mom Is Not Cooking

There may be days where Mom is away or does not plan to cook.

Instead of leaving the state ambiguous, Mom can use a quick status:

"Everyone handle this meal yourselves"

An optional message can be included.

Example:

"Mom is going out today. Tun can order food for you two."

This should notify Kha and Bin.

Mom may later choose **Đổi kế hoạch** and change the same meal slot from self-service to an open choice or option poll. This updates the existing request rather than creating another request for the same date and meal type.

---

# 10. Final Meal

Mom is responsible for confirming what was actually prepared.

An active PARENT can save actual lunch/dinner dishes with or without a meal request. Each date and meal type has at most one final meal. A linked request must use the same slot, and saving dishes leaves family responses unchanged. Self-service must first be changed through **Đổi kế hoạch**. ADMIN and MEMBER have read-only access to final meals.

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

The implemented action is **Bữa ăn đã sẵn sàng**. Retrying it retains the first ready time and reuses each recipient's notification. Mom can edit the ready message afterward without resetting read state. Parents and inactive members do not receive meal-ready notifications.

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

Each student member can maintain their own university timetable.

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

# 15. Dishwashing Chores

Mom creates and manages the dishwashing schedule.

Example:

Monday:
Bin

Tuesday:
Tun

Wednesday:
Bin

Thursday:
Tun

Kha and Bin can view the schedule.

A future version may support completion confirmation.

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

Fitness tracking should initially remain simple.

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

# 23. Household Food Expenses

Household food spending is managed by Mom.

Only Mom is expected to enter household food expenses in normal usage.

Possible categories include:

- Breakfast
- Groceries
- Eating out
- Drinks
- Other

Example:

Date:
19/10/2026

Amount:
320,000 VND

Category:
Groceries

Note:
Meat, vegetables, fish

---

## 23.1 Household Spending Analytics

The system should calculate:

- total food spending this month;
- previous month's total;
- difference in amount;
- percentage change;
- spending by category.

Example:

October:
4,320,000 VND

September:
3,850,000 VND

Difference:
+470,000 VND

Change:
+12.2%

The system should present the result neutrally rather than judge the family's spending.

---

# 24. Personal Expense Tracking

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
