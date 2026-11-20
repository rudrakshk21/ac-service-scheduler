/** A named priority level. A higher weight is planned earlier (it is added to the case's bonus). */
export interface PriorityLevel {
  name: string
  weight: number
}

/** Planning settings. Times are minutes, distances kilometres, dates whole day numbers since 1970-01-01. */
export interface Settings {
  baseLat: number
  baseLon: number
  speedKmh: number
  roadFactor: number
  sameAreaHopMin: number
  usableMin: number
  dayStartMin: number
  lunchStartMin: number
  breakMin: number
  ageWeight: number
  balanceWeight: number
  maxKm: number
  horizonDays: number
  /** 0 = Monday ... 6 = Sunday. */
  restWeekdays: number[]
  holidays: number[]
  startDay: number
  /** Priority levels, lowest first. Absent: Normal (weight 0) and Escalated (weight 100000). */
  priorityLevels?: PriorityLevel[]
  /** Bonus points per day once a due date is near. Absent: 8. */
  dueWeight?: number
  /** Urgency starts this many days before the due day. Absent: 5. */
  urgencyWindowDays?: number
}

export interface WorkType {
  name: string
  serviceMin: number
  dailyCeiling: number
  requiredSkill: number
}

export interface Technician {
  name: string
  skills: number[]
  active: boolean
  leaveFrom?: number
  leaveTo?: number
  /** Place the day starts at (index into `places`). Absent: the base. */
  startPlace?: number
  /** Place the day ends at (index into `places`). Absent: the base. */
  endPlace?: number
  /** Own working hours. Each one absent: the shared setting of the same name. */
  dayStartMin?: number
  usableMin?: number
  lunchStartMin?: number
  breakMin?: number
}

export interface Place {
  name: string
  lat: number
  lon: number
}

export interface CaseIn {
  id: string
  workType: number
  place: number
  /** Shorthand for the last priority level. Absent: false. Ignored when `priority` is given. */
  escalated?: boolean
  /** Index into the priority levels. Absent: the last level when `escalated`, otherwise level 0. */
  priority?: number
  /** Day the visit is promised by. Soft: urgency grows as it nears, and a later visit is flagged late. */
  dueDay?: number
  reportedDay: number
  /** Manual technician: index into `technicians`. */
  pinnedTech?: number
  /** Earliest day the case may be planned; with `pinnedTech` it is also the day it is placed. */
  earliestDay?: number
  /** Technician kept from the earlier plan, honoured on the start day only. */
  frozenTech?: number
}

export interface PlanInput {
  settings: Settings
  workTypes: WorkType[]
  technicians: Technician[]
  places: Place[]
  cases: CaseIn[]
}

export interface ScheduledCase {
  id: string
  day: number
  tech: number
  visit: number
  /** "HH:MM". */
  eta: string
  travelMin: number
  prevKm: number
  why: string
  flag: string
}

export interface UnscheduledCase {
  id: string
  reason: string
}

export interface RouteSummary {
  day: number
  tech: number
  stops: string[]
  travelMin: number
  serviceMin: number
  load: number
}

export interface PlanResult {
  /** In input case order. */
  scheduled: ScheduledCase[]
  /** In input case order. */
  unscheduled: UnscheduledCase[]
  days: number[]
  /** In day order; within a day, in technician order. Includes technicians with an empty route. */
  routes: RouteSummary[]
}
