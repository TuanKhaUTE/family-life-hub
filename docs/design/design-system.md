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

Possible primary navigation:

Home

Meals

Schedule

Activity

Profile

Depending on implementation, Activity may group:

- study;
- fitness;
- wellness;
- expenses.

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

Parent-created meal requests should feel conversational.

Example:

"Mẹ có gà rồi, hai đứa muốn ăn món nào?"

Option cards appear below.

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

---

# 18. Timetable Design

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

Dishwashing duties should feel playful rather than punitive.

Example:

"Today's dish hero"

Bin Bin

Avoid harsh language such as:

"Assigned task"

when a warmer phrase is appropriate.

---

# 20. Wellness Design

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

Fitness should emphasize consistency.

Preferred visualizations:

weekly session progress;

completed workouts;

weekly goals.

Avoid encouraging unhealthy daily workout streaks.

---

# 22. Study Design

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