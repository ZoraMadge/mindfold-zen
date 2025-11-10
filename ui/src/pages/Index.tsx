import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import GameArena from "@/components/GameArena";
import { toast } from "sonner";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <Hero />
        <GameArena />
      </main>
    </div>
  );
};

export default Index;

