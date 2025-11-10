import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logo from '/logo.svg';

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Mindfold Zen Logo" className="w-10 h-10 float-gentle" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Mindfold Zen</h1>
              <p className="text-xs text-muted-foreground">Strategy Arena</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/history">History</Link>
            </Button>
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

