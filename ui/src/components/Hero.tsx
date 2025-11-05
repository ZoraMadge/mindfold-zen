// import heroBg from "@/assets/hero-bg.png";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20" />
      <div className="absolute inset-0 bg-gradient-zen opacity-60" />
      
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <div className="reveal-fold">
          <h2 className="text-5xl md:text-7xl font-bold mb-6 text-foreground leading-tight">
            Hide Intention.<br />
            Reveal Mastery.
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Commit your strategic moves in encrypted form. Only upon resolution will your opponent see your choice—no reactive play, pure strategic depth.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12 reveal-fold" style={{ animationDelay: '0.2s' }}>
          <div className="paper-fold bg-card rounded-2xl p-8 shadow-elevated max-w-md">
            <h3 className="text-2xl font-semibold mb-4 text-foreground">The Art of Commitment</h3>
            <p className="text-muted-foreground leading-relaxed">
              Each round, both players secretly encrypt their moves. Once committed, there's no turning back. Strategy becomes pure—no bluffing based on opponent reactions.
            </p>
          </div>
        </div>

        <div className="mt-12 reveal-fold" style={{ animationDelay: '0.4s' }}>
          <div className="paper-fold bg-card rounded-2xl p-8 shadow-elevated max-w-3xl mx-auto">
            <h3 className="text-2xl font-semibold mb-6 text-foreground">How to Play</h3>
            <div className="grid md:grid-cols-4 gap-4 text-left">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">1. Select Move</h4>
                <p className="text-sm text-muted-foreground">Choose from 4 strategic moves: Attack North, Attack South, Defend North, or Defend South.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">2. Encrypt & Commit</h4>
                <p className="text-sm text-muted-foreground">Your move is encrypted and submitted to the blockchain. No one can see it until both players commit.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">3. Wait for Opponent</h4>
                <p className="text-sm text-muted-foreground">Opponent has 3 minutes to respond. If they don't, you win by forfeit.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">4. Reveal & Resolve</h4>
                <p className="text-sm text-muted-foreground">Once both moves are committed, the game resolves automatically and results are revealed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 reveal-fold" style={{ animationDelay: '0.6s' }}>
          <div className="paper-fold bg-card rounded-2xl p-8 shadow-elevated max-w-3xl mx-auto">
            <h3 className="text-2xl font-semibold mb-6 text-foreground">Winning Conditions</h3>
            <div className="space-y-4 text-left">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">⚔️ You Win If:</h4>
                <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                  <li>You attack a direction (North or South) and your opponent does <strong>not</strong> defend that same direction</li>
                  <li>Your opponent attacks a direction and you defend that same direction</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">🤝 Tie If:</h4>
                <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                  <li>Both players choose the exact same move</li>
                  <li>Both players attack, but in different directions</li>
                  <li>Both players defend (regardless of direction)</li>
                </ul>
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground italic">
                  <strong>Example:</strong> If you Attack North and your opponent Defends South (or Attacks South), you win! 
                  But if they Defend North, they win instead.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

