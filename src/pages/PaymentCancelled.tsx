import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

const PaymentCancelled = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "#1A202C" }}
    >
      <Card className="max-w-md w-full bg-card border-border">
        <CardHeader className="text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <CardTitle className="text-2xl text-foreground">
            Payment Cancelled
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your payment was not completed. You can try again at any time.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Back to Platform
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancelled;
