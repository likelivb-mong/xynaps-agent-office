// Central agent icon mapping — SVG pictograms, no emoji
import {
  AgentIconCeo,
  AgentIconConcept,
  AgentIconPd,
  AgentIconPuzzle,
  AgentIconSpace,
  AgentIconOps,
  AgentIconSound,
  AgentIconXfiler,
  AgentIconCommon,
} from './Icon'

type IconProps = React.SVGProps<SVGSVGElement>

const AGENT_ICONS: Record<string, React.ComponentType<IconProps>> = {
  ceo: AgentIconCeo,
  concept: AgentIconConcept,
  pd: AgentIconPd,
  puzzle: AgentIconPuzzle,
  space: AgentIconSpace,
  ops: AgentIconOps,
  sound: AgentIconSound,
  xfiler: AgentIconXfiler,
  __common__: AgentIconCommon,
}

export function AgentIcon({ agentId, ...props }: { agentId: string } & IconProps) {
  const Icon = AGENT_ICONS[agentId] ?? AgentIconCeo
  return <Icon {...props} />
}
