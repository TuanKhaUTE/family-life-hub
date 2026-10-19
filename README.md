# Family Life Hub

Family Life Hub is a personal full-stack Progressive Web App created to help a real family manage everyday life in one warm and simple place.

The project began with a simple problem:

Mom regularly needs to ask what her children want to eat.

From that problem, the project is designed to gradually support:

- meal planning;
- breakfast selections;
- lunch and dinner requests;
- cooking feedback;
- family timetables;
- dishwashing schedules;
- notifications;
- wellness and fitness tracking;
- study tracking;
- household food expenses;
- private personal expenses;
- positive family gamification.

## Project Status

Planning and architecture stage.

No application code has been implemented yet.

## Planned Stack

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

## Development Philosophy

Family Life Hub is developed incrementally.

Each feature should follow:

Plan

→ Implement

→ Automated checks

→ Manual test

→ Review Git diff

→ Meaningful commit

→ Push

Large one-shot implementations are intentionally avoided.

## Documentation

Product specification:

`docs/requirements/product-spec.md`

System architecture:

`docs/architecture/system-architecture.md`

Design system:

`docs/design/design-system.md`

Initial data model:

`docs/database/data-model.md`

Project agent instructions:

`AGENTS.md`

## Repository

The application will use a single repository with separated frontend and backend projects.

```text
family-life-hub/
├── frontend/
├── backend/
├── database/
├── docs/
├── postman/
├── AGENTS.md
└── README.md