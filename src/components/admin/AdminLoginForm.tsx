
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Shield, Factory } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

const AdminLoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !email || !password1 || !password2) {
      setError('All fields are required');
      setIsLoading(false);
      return;
    }

    const success = login(username, email, password1, password2);
    
    if (!success) {
      setError('Invalid credentials. Access denied.');
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center text-2xl text-blue-700">
          <Factory className="w-8 h-8 mr-3" />
          🏭 SMBOT Admin Access
        </CardTitle>
        <div className="flex items-center justify-center text-sm text-gray-600">
          <Shield className="w-4 h-4 mr-1" />
          Secure Factory Control Center
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium text-gray-700">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-blue-200 focus:border-blue-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-blue-200 focus:border-blue-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password1" className="text-sm font-medium text-gray-700">
              Primary Access Code
            </Label>
            <div className="relative">
              <Input
                id="password1"
                type={showPassword1 ? 'text' : 'password'}
                placeholder="Enter primary access code"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                className="border-blue-200 focus:border-blue-400 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword1(!showPassword1)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password2" className="text-sm font-medium text-gray-700">
              Secondary Access Code
            </Label>
            <div className="relative">
              <Input
                id="password2"
                type={showPassword2 ? 'text' : 'password'}
                placeholder="Enter secondary access code"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="border-blue-200 focus:border-blue-400 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword2(!showPassword2)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Authenticating...' : '🔓 Access Factory Control'}
          </Button>

          <div className="text-xs text-gray-500 text-center">
            Authorized Personnel Only • Press Ctrl+Alt+A to access
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminLoginForm;
