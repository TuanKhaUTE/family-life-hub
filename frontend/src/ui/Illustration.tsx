export function HomeIllustration({
  kind,
}: {
  kind: 'parent' | 'member'
}) {
  if (kind === 'parent') {
    return (
      <svg className="home-illustration" viewBox="0 0 180 132" aria-hidden="true">
        <path className="illustration-cloud" d="M18 104c14-22 35-29 57-18 20-27 63-18 68 12 19-3 31 8 36 20H18Z" />
        <path className="illustration-sage" d="M32 107c5-20 18-28 34-30 7 12 6 24-2 35H31Z" />
        <path className="illustration-peach" d="M88 54c0-14 11-25 25-25s25 11 25 25v38H88Z" />
        <circle className="illustration-skin" cx="113" cy="42" r="14" />
        <path className="illustration-ink" d="M99 42c2-12 25-19 30 1-6-4-16-5-30-1Z" />
        <path className="illustration-ink" d="M108 45h1M118 45h1M108 52c4 3 8 3 12 0" />
        <path className="illustration-sage-dark" d="M98 92h42v14H98z" />
        <path className="illustration-cream" d="M75 87h45c4 0 7 3 7 7v10H68V94c0-4 3-7 7-7Z" />
        <path className="illustration-terracotta" d="M75 84h42v5H75z" />
        <path className="illustration-ink" d="M102 78c3-8 9-8 12 0M108 75c-1-9 4-11 7-2" />
        <circle className="illustration-yellow" cx="42" cy="34" r="9" />
        <path className="illustration-yellow" d="m42 18 1 5M42 45l1 5M26 34h5M53 34h5" />
      </svg>
    )
  }
  return (
    <svg className="home-illustration" viewBox="0 0 180 132" aria-hidden="true">
      <path className="illustration-cloud" d="M10 108c10-20 33-27 52-17 11-28 57-28 68 4 19-8 39 3 43 17H10Z" />
      <path className="illustration-lavender" d="M83 50c0-13 11-23 24-23s24 10 24 23v42H83Z" />
      <circle className="illustration-skin" cx="107" cy="39" r="14" />
      <path className="illustration-ink" d="M93 39c2-13 25-18 30 1-7-3-17-4-30-1Z" />
      <path className="illustration-ink" d="M101 43h1M112 43h1M101 50c3 2 7 2 10 0" />
      <path className="illustration-sage-dark" d="M91 88h40v17H91z" />
      <path className="illustration-cream" d="M36 80h50c4 0 7 3 7 7v18H29V87c0-4 3-7 7-7Z" />
      <path className="illustration-peach" d="M29 82h64v8H29z" />
      <path className="illustration-ink" d="M44 100v11M77 100v11M44 111h-8M77 111h8" />
      <path className="illustration-yellow" d="M57 73h10v8H57z" />
      <path className="illustration-yellow" d="M62 58c-5 6-5 10 0 14 5-4 5-8 0-14Z" />
    </svg>
  )
}

export function KitchenIllustration() {
  return (
    <svg className="feature-illustration kitchen-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M8 92c14-18 34-23 51-13 12-25 53-25 64 3 19-5 42 5 49 19H8Z" />
      <path className="illustration-sage" d="M26 91c4-18 16-27 31-29 6 11 4 25-4 34H25Z" />
      <path className="illustration-peach" d="M75 64c0-15 12-26 27-26h22v42H75Z" />
      <circle className="illustration-skin" cx="104" cy="31" r="13" />
      <path className="illustration-ink" d="M91 31c4-12 24-17 29 1-7-4-17-4-29-1ZM99 34h1M109 34h1M99 41c3 2 7 2 10 0" />
      <path className="illustration-cream" d="M53 68h91c5 0 9 4 9 9v15H44V77c0-5 4-9 9-9Z" />
      <path className="illustration-terracotta" d="M49 67h99v8H49z" />
      <path className="illustration-sage-dark" d="M71 56c-1-12 6-17 10-20 1 8-1 14-5 20M78 57c5-10 11-12 16-13-2 7-7 12-14 15" />
      <path className="illustration-sage-dark" d="M137 61c5-8 11-10 16-10-2 7-7 11-15 13M143 64c-2-8 1-13 5-17 3 7 0 13-5 17" />
      <path className="illustration-yellow" d="M62 83c8-8 16-8 24 0-7 7-15 7-24 0Z" />
      <path className="illustration-ink" d="M70 83c4-4 8-4 12 0" />
    </svg>
  )
}

export function CalendarIllustration() {
  return (
    <svg className="feature-illustration calendar-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M8 92c15-21 37-25 56-13 12-25 53-25 64 3 17-6 40 3 48 18H8Z" />
      <rect className="illustration-sage" x="42" y="27" width="83" height="61" rx="11" />
      <path className="illustration-sage-dark" d="M42 43h83v12H42z" />
      <path className="illustration-cream" d="M56 20v17M111 20v17" />
      <path className="illustration-ink" d="M56 20v17M111 20v17" />
      <circle className="illustration-peach" cx="61" cy="67" r="6" />
      <circle className="illustration-yellow" cx="84" cy="67" r="6" />
      <circle className="illustration-lavender" cx="107" cy="67" r="6" />
      <path className="illustration-ink" d="M72 61h23M72 61l7-7M86 61l7-7" />
      <path className="illustration-terracotta" d="M142 82c0-15 7-28 15-35 3 14 1 27-7 37Z" />
      <path className="illustration-sage-dark" d="M149 86c0-13 7-22 15-28-1 14-5 24-14 31Z" />
    </svg>
  )
}

export function FoodIllustration({ variant = 'breakfast' }: { variant?: 'breakfast' | 'dinner' | 'final' | 'groceries' }) {
  const bowlClass = variant === 'dinner' ? 'illustration-peach' : variant === 'final' ? 'illustration-lavender' : 'illustration-sage'
  return (
    <svg className="feature-illustration food-illustration" viewBox="0 0 72 56" aria-hidden="true">
      <path className="illustration-cloud" d="M8 42c4-9 14-12 23-8 5-11 22-11 28 1 5-2 10 1 13 7H8Z" />
      <path className={bowlClass} d="M14 27h44c-2 14-10 21-22 21S16 41 14 27Z" />
      <path className="illustration-terracotta" d={variant === 'groceries' ? 'M24 12h24l3 31H21Z' : 'M17 26h38c-3-8-9-12-19-12s-16 4-19 12Z'} />
      <path className="illustration-yellow" d="M28 16c-2-6 2-10 6-13 4 4 4 8 0 13M42 16c1-6 5-8 9-9 0 5-3 9-8 11" />
      <circle className="illustration-sage-dark" cx="24" cy="19" r="3" />
      <circle className="illustration-sage-dark" cx="50" cy="19" r="3" />
      <path className="illustration-ink" d={variant === 'groceries' ? 'M29 18h14M29 24h14M29 30h10' : 'M18 27h36'} />
    </svg>
  )
}

export function StudyIllustration() {
  return (
    <svg className="feature-illustration study-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M7 92c14-20 36-24 55-13 11-24 52-24 64 3 19-5 40 4 47 18H7Z" />
      <path className="illustration-lavender" d="m46 83 39-35 39 35-39 20Z" />
      <path className="illustration-cream" d="m50 81 35-30 35 30-35 16Z" />
      <path className="illustration-sage-dark" d="M85 51v44M55 80l30 15 30-15" />
      <path className="illustration-peach" d="M120 75c3-18 13-26 23-31 0 15-4 27-15 35Z" />
      <path className="illustration-sage-dark" d="M130 83c-1-12 5-20 13-26 1 12-3 22-12 29Z" />
      <circle className="illustration-yellow" cx="42" cy="35" r="8" />
      <path className="illustration-ink" d="M42 21v5M28 35h5M51 35h5M42 44v5" />
    </svg>
  )
}

export function FitnessIllustration() {
  return (
    <svg className="feature-illustration fitness-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M7 92c14-20 36-24 55-13 11-24 52-24 64 3 19-5 40 4 47 18H7Z" />
      <path className="illustration-sage" d="M78 48h24v48H78z" />
      <path className="illustration-terracotta" d="M54 38h72v12H54z" />
      <path className="illustration-peach" d="M43 32h13v24H43zM124 32h13v24h-13z" />
      <path className="illustration-sage-dark" d="M63 75c11-13 22-15 32-7-9 12-20 17-32 14M112 75c-11-13-22-15-32-7 9 12 20 17 32 14" />
      <circle className="illustration-yellow" cx="91" cy="26" r="7" />
      <path className="illustration-ink" d="M91 13v5M79 26h5M98 26h5" />
    </svg>
  )
}

export function WellnessIllustration() {
  return (
    <svg className="feature-illustration wellness-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M7 92c14-20 36-24 55-13 11-24 52-24 64 3 19-5 40 4 47 18H7Z" />
      <path className="illustration-sage" d="M83 89c-2-22 5-36 18-48 4 19-1 36-13 49Z" />
      <path className="illustration-sage-dark" d="M94 90c2-21 11-32 24-40-2 18-9 32-23 43Z" />
      <path className="illustration-peach" d="M47 77c8-17 23-22 37-18-5 17-17 25-35 25Z" />
      <path className="illustration-cream" d="M55 73c8-8 16-10 23-8-7 8-14 11-23 12Z" />
      <circle className="illustration-yellow" cx="130" cy="34" r="9" />
      <path className="illustration-ink" d="M130 19v5M115 34h5M140 34h5M130 45v5" />
    </svg>
  )
}

export function ExpenseIllustration() {
  return (
    <svg className="feature-illustration expense-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M7 92c14-20 36-24 55-13 11-24 52-24 64 3 19-5 40 4 47 18H7Z" />
      <rect className="illustration-sage" x="51" y="25" width="78" height="62" rx="11" />
      <path className="illustration-cream" d="M51 40h78v12H51z" />
      <path className="illustration-terracotta" d="M66 67h47v9H66z" />
      <circle className="illustration-yellow" cx="76" cy="31" r="5" />
      <path className="illustration-peach" d="M136 84c3-17 12-26 23-32 0 17-6 28-17 36Z" />
      <path className="illustration-sage-dark" d="M145 89c0-12 7-20 16-26-1 13-6 22-16 29Z" />
    </svg>
  )
}

export function ProfileIllustration() {
  return (
    <svg className="feature-illustration profile-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M7 92c14-20 36-24 55-13 11-24 52-24 64 3 19-5 40 4 47 18H7Z" />
      <circle className="illustration-peach" cx="88" cy="42" r="25" />
      <circle className="illustration-skin" cx="88" cy="39" r="13" />
      <path className="illustration-ink" d="M75 39c3-12 23-17 28 1-7-4-17-4-28-1M83 43h1M93 43h1M83 50c3 2 7 2 10 0" />
      <path className="illustration-sage-dark" d="M55 91c3-23 16-32 33-32s30 9 33 32Z" />
      <path className="illustration-yellow" d="M42 31c-4-8 0-14 6-18 2 7 0 13-6 18M136 74c7-7 14-7 19-4-4 7-11 10-19 9" />
    </svg>
  )
}
