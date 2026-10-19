# AGENTS.md — Family Life Hub

## Project Identity

Family Life Hub is Kha's personal full-stack project.

It is a private family-oriented Progressive Web App built to solve real daily household problems including:

- meal planning;
- family schedules;
- chores;
- notifications;
- wellness;
- fitness;
- study;
- spending;
- positive gamification.

This is intended to be a long-lived personal project and portfolio project.

Code quality, architecture, understandable Git history, and maintainability matter.

---

## Read Before Coding

Before implementing any feature, read the relevant project documentation:

docs/requirements/product-spec.md

docs/architecture/system-architecture.md

docs/design/design-system.md

docs/database/data-model.md

Do not contradict these documents without discussing the change first.

---

## Core Stack

Frontend:

React + Vite + TypeScript

Backend:

Node.js + Express + TypeScript

Database:

Supabase PostgreSQL

Application:

Progressive Web App

Deployment:

Vercel

Package manager:

npm

---

## Repository Structure

Maintain clear root separation:

frontend/

backend/

database/

docs/

postman/

Do not mix backend code into the frontend directory.

Do not place frontend source code inside backend.

---

## Backend Architecture

Use the following request flow when appropriate:

Route

Controller

Service

Repository

Database

Responsibilities:

Routes:
endpoint definitions and middleware wiring.

Controllers:
HTTP request and response handling.

Services:
business rules.

Repositories:
database access.

Do not put substantial business logic directly inside Express route handlers.

Avoid creating unnecessary abstractions where there is no real responsibility.

---

## Frontend Architecture

Prefer feature-oriented frontend organization.

Domain-specific components belong with their feature.

Shared generic UI belongs under common component directories.

Avoid giant page components containing:

API logic;

complex business rules;

large amounts of reusable UI;

unrelated domain behavior.

---

## Security Rules

Never store raw PINs.

Never commit:

API keys;

database credentials;

service-role keys;

tokens;

private family data.

Never rely only on frontend checks for authorization.

The backend must enforce:

roles;

ownership;

privacy.

ADMIN does not automatically have permission to read all private user data.

---

## Privacy Rules

Wellness, fitness, study, grades, and personal expenses are private by default.

Technical administration is different from personal-data access.

Do not implement ADMIN as unrestricted access to every table.

Respect:

resource ownership;

module privacy;

record-level sharing.

---

## UI Rules

The application must feel:

warm;

cozy;

family-oriented;

friendly;

soft;

playful but not childish.

Do not introduce:

cyber aesthetics;

neon dashboards;

excessive glassmorphism;

random gradients;

heavy 3D;

unnecessary glowing effects.

Follow:

docs/design/design-system.md

before designing new UI.

---

## UI Libraries

Preferred base:

shadcn/ui

Optional enhancement sources:

React Bits

Motion Primitives

Uiverse

21st.dev

UI/UX Pro Max

ThreeUI

External components must be adapted to the project's design system.

Do not combine unrelated component styles without normalization.

---

## Mobile-First Rule

Every core feature must work comfortably on a phone.

Do not design desktop first and shrink it afterward.

Important controls should have comfortable touch targets.

---

## Implementation Strategy

Work in small vertical slices.

Do not implement multiple major features in a single task unless explicitly requested.

Example:

good:

"Add backend health endpoint."

good:

"Add profile PIN login."

bad:

"Build authentication, meals, timetable, fitness, study and expenses."

---

## Scope Discipline

Implement only what the current task requests.

Do not automatically add:

future features;

AI;

extra database tables;

unused abstractions;

unrequested libraries;

placeholder domain code.

If a future concern is noticed, mention it in the final summary rather than implementing it automatically.

---

## Dependency Rule

Before adding a dependency:

determine why it is necessary.

Prefer existing project dependencies when suitable.

Do not install a large library to solve a trivial problem.

---

## Testing Rule

Every implementation task should run the relevant checks.

Expected checks when available:

npm test

npm run lint

npm run build

backend tests

frontend tests

TypeScript compilation

Do not claim a test passed unless it was actually run.

---

## Manual Testing

Automated tests do not replace manual review.

After implementing a user-facing feature:

describe how Kha should manually test it.

Do not commit before manual review unless explicitly instructed.

---

## Git Rules

Never commit automatically unless Kha explicitly approves.

Never push automatically unless Kha explicitly approves.

Before requesting commit approval:

run git status;

inspect git diff;

summarize changed files;

report tests.

Use meaningful Conventional Commit-style messages where appropriate.

Examples:

chore: initialize full-stack project foundation

feat(auth): add family PIN login

feat(meals): add recurring breakfast selection

fix(schedule): preserve cancelled class state

docs: define system architecture

Avoid meaningless commit messages such as:

update

fix stuff

test

changes

final

---

## Feature Completion Rule

A feature is not complete simply because code exists.

Before considering a feature complete:

implementation works;

lint passes;

build passes;

relevant tests pass;

manual test is performed;

Git diff is reviewed;

no secrets are included;

no unrelated files are changed.

---

## Database Rules

Use migrations for schema changes.

Implement database schema incrementally.

Do not create every future table during project initialization.

Database code must remain consistent with:

docs/database/data-model.md

unless the specification is intentionally updated.

---

## API Rules

Use REST-style JSON APIs.

Keep response formats consistent.

Validate input server-side.

Use centralized backend error handling.

Do not expose stack traces or internal secrets in production API responses.

---

## Authentication Rules

The visible login flow uses:

family profile selection

+

6-digit PIN.

There is no public signup.

Initial accounts are pre-created.

Do not silently replace this with email/password authentication.

---

## Meal Rules

Breakfast and lunch/dinner are intentionally different workflows.

Breakfast:

recurring;

catalog-based;

daily deadline;

supports custom choice;

supports Not Eating.

Lunch / Dinner:

created by Mom when needed;

supports open choice;

supports option poll;

supports deadline;

supports Self Service status.

Do not force all meal types into one identical UI workflow.

---

## Meal State Rule

NO_RESPONSE and NOT_EATING are different states.

Do not interpret missing data as NOT_EATING.

---

## Timetable Rule

Everyone may view family timetables.

Only the timetable owner edits their timetable.

ADMIN does not automatically edit another member's timetable.

---

## Personal Finance Rule

Personal expenses are private by default.

Do not expose one member's spending to another member unless sharing is explicitly enabled.

---

## Wellness Rule

Wellness features should provide neutral informational feedback.

Do not produce aggressive or medical-sounding judgments.

BMI, calorie estimates and related calculations are informational estimates.

---

## Gamification Rule

Gamification must be positive.

Never create embarrassing rankings based on:

weight;

grades;

personal spending;

other sensitive information.

---

## Code Quality

Prefer:

clear names;

small functions;

explicit types;

predictable control flow;

simple abstractions.

Avoid:

premature optimization;

clever but hard-to-read code;

large multi-purpose modules;

copy-pasted business logic.

---

## Comments

Code comments should explain:

why

rather than repeat:

what obvious code already does.

---

## Documentation

When a task changes an established product rule, architecture decision, or design rule, update the relevant documentation as part of the same reviewed change.

Do not let documentation silently drift away from implementation.

---

## Final Task Report

After completing a coding task, report:

what was implemented;

files materially changed;

commands run;

test results;

known limitations;

manual testing steps;

git status.

Then stop.

Do not commit or push unless explicitly approved.