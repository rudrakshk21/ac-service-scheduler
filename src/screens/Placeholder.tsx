interface PlaceholderProps {
  title: string
  text: string
}

/** A screen that is not built yet says what it will do. Replaced as each screen arrives. */
export default function Placeholder({ title, text }: PlaceholderProps) {
  return (
    <section className="screen">
      <h1 className="screen-title" tabIndex={-1}>{title}</h1>
      <div className="empty">
        <p>{text}</p>
      </div>
    </section>
  )
}
