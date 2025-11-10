import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="paper-fold p-12 bg-gradient-paper shadow-fold text-center max-w-md">
        <h1 className="text-6xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Page not found
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;

