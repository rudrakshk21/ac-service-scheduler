import { LevelsSection, SkillsSection, WorkTypesSection } from './CatalogueSection'
import { HolidaysSection } from './HolidaysSection'
import { PlacesSection } from './PlacesSection'
import { RulesSection, SiteSection } from './SiteSection'
import { TechniciansSection } from './TechniciansSection'
import '../import/import.css'
import './setup.css'

const JUMPS: [string, string][] = [
  ['set-site', 'Your centre'], ['set-rules', 'Rules'], ['set-types', 'Work types'], ['set-skills', 'Skills'], ['set-levels', 'Priorities'],
  ['set-places', 'Places'], ['set-techs', 'Technicians'], ['set-holidays', 'Holidays'],
]

export default function SetupScreen() {
  const jump = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    el?.parentElement?.focus()
  }
  return (
    <section className="screen stack">
      <div>
        <h1 className="screen-title" tabIndex={-1}>Set-up</h1>
        <p className="screen-lede">Tell the planner about your centre. Changes are saved as you make them and the plan follows.</p>
      </div>
      <nav className="setup-nav" aria-label="Sections of this page">
        {JUMPS.map(([id, label]) => <button key={id} type="button" onClick={() => jump(id)}>{label}</button>)}
      </nav>
      <SiteSection />
      <RulesSection />
      <WorkTypesSection />
      <SkillsSection />
      <LevelsSection />
      <PlacesSection />
      <TechniciansSection />
      <HolidaysSection />
    </section>
  )
}
