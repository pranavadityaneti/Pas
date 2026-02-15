import { Hero } from "@/components/Hero";
import { EcosystemShowcase } from "@/components/EcosystemShowcase";
import { CommuteRun } from "@/components/CommuteRun";
import { QueueEraser } from "@/components/QueueEraser";

export default function Home() {
  return (
    <main>
      <Hero />
      <EcosystemShowcase />
      <QueueEraser />
      <CommuteRun />
    </main>
  );
}
