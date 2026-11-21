import { useId } from 'react'
import { setLocale, t } from './index'
import { LOCALES, selectable } from './locales'
import { useLocale } from './useLocale'

/** Chooses the language. A test language that was asked for by address is listed while it is on, so the choice shows. */
export function LanguageSelect() {
  const code = useLocale()
  const id = useId()
  const current = LOCALES.find((l) => l.code === code)
  const options = current?.test === true ? [...selectable(), current] : selectable()
  return (
    <div className="lang-select">
      <label htmlFor={id} className="visually-hidden">{t('lang.label')}</label>
      <select id={id} value={code} onChange={(e) => void setLocale(e.target.value)}>
        {options.map((l) => (
          <option key={l.code} value={l.code} lang={l.code === 'xa' || l.code === 'xb' ? 'en' : l.code}>{l.name}</option>
        ))}
      </select>
    </div>
  )
}
