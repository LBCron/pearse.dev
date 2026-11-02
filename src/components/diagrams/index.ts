import type { DiagramName } from '../../lib/diagrams';
import MtsHub from './MtsHub.astro';
import WetlabsApp from './WetlabsApp.astro';
import MtsCortex from './MtsCortex.astro';
import Observability from './Observability.astro';
import EastCoastBlinds from './EastCoastBlinds.astro';
import DublinPleinAir from './DublinPleinAir.astro';
import PearseDev from './PearseDev.astro';
import AgenticWorkflow from './AgenticWorkflow.astro';

/** Frontmatter `diagram:` name -> component. Add new diagrams here and in DIAGRAM_NAMES. */
export const DIAGRAMS: Record<DiagramName, typeof MtsHub> = {
  MtsHub,
  WetlabsApp,
  MtsCortex,
  Observability,
  EastCoastBlinds,
  DublinPleinAir,
  PearseDev,
  AgenticWorkflow,
};
