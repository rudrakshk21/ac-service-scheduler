import { t, type MessageKey } from '../../i18n'
import { LevelsSection, SkillsSection, WorkTypesSection } from './CatalogueSection'
import { DataSection } from './DataSection'
import { HolidaysSection } from './HolidaysSection'
import { PlacesSection } from './PlacesSection'
import { RulesSection, SiteSection } from './SiteSection'
import { TechniciansSection } from './TechniciansSection'
import '../import/import.css'
import './setup.css'

const JUMPS: [string, MessageKey][] = [
  ['set-site', 'setup.jump.site'], ['set-rules', 'setup.jump.rules'], ['set-types', 'setup.jump.types'], ['set-skills', 'setup.jump.skills'],
  ['set-levels', 'setup.jump.levels'], ['set-places', 'setup.jump.places'], ['set-techs', 'setup.jump.techs'], ['set-holidays', 'setup.jump.holidays'],
  ['set-data', 'setup.jump.data'],
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
        <h1 className="screen-title" tabIndex={-1}>{t('setup.title')}</h1>
        <p className="screen-lede">{t('setup.lede')}</p>
      </div>
      <nav className="setup-nav" aria-label={t('setup.jump.aria')}>
        {JUMPS.map(([id, key]) => <button key={id} type="button" onClick={() => jump(id)}>{t(key)}</button>)}
      </nav>
      <SiteSection />
      <RulesSection />
      <WorkTypesSection />
      <SkillsSection />
      <LevelsSection />
      <PlacesSection />
      <TechniciansSection />
      <HolidaysSection />
      <DataSection />
    </section>
  )
}
