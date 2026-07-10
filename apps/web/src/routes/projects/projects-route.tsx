import { ProjectsPortfolio } from "@/features/projects/portfolio";

/**
 * Projects portfolio route. Renders inside the authenticated app shell's
 * `<main>`; all list/search/filter/create behavior lives in the owned
 * `features/projects/portfolio` module.
 */
export function ProjectsRoute() {
  return <ProjectsPortfolio />;
}
