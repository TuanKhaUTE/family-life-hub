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
