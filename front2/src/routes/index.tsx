import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/dateasy/TopBar";
import { Greeting } from "@/components/dateasy/Greeting";
import { Chips } from "@/components/dateasy/Chips";
import { RadarCard } from "@/components/dateasy/RadarCard";
import { MeetingsList } from "@/components/dateasy/MeetingsList";
import { Posters } from "@/components/dateasy/Posters";
import { AIBuilder } from "@/components/dateasy/AIBuilder";
import { BottomNav } from "@/components/dateasy/BottomNav";
import { GiveawayTeaser } from "@/components/dateasy/GiveawayTeaser";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <PhoneFrame>
      <TopBar />
      <Greeting />
      <Chips />
      <RadarCard />
      <GiveawayTeaser />
      <MeetingsList />
      <Posters />
      <AIBuilder />
      <BottomNav />
      <div className="h-32" />
    </PhoneFrame>
  );
}
