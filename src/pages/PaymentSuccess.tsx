import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "#1A202C" }}
    >
      <Card className="max-w-md w-full bg-card border-border">
        <CardHeader className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl text-foreground">
            Payment Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your subscription has been activated successfully via NovaPay. You can now start using your bots.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Back to Platform
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
