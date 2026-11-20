import type { Dispatch } from 'react'
import type { FlowAction, FlowState } from './importFlow'

export interface StepProps {
  flow: FlowState
  dispatch: Dispatch<FlowAction>
}
