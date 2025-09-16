import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import MerchantDashboard from "@/pages/merchant-dashboard";
import MerchantSettings from "@/pages/merchant-settings";
import EmployeeDashboard from "@/pages/employee-dashboard";
import ClientDashboard from "@/pages/client-dashboard";
import NewAppointment from "@/pages/new-appointment";
import Schedule from "@/pages/schedule";
import Services from "@/pages/services";
import Employees from "@/pages/employees";
import EmployeeDaysOff from "@/pages/employee-days-off";
import Clients from "@/pages/clients";
import Merchants from "./pages/merchants";
import MerchantAccess from "./pages/merchant-access";
import Reports from "@/pages/reports";
import ClientBooking from "@/pages/client-booking";
import MerchantPenalties from "@/pages/merchant-penalties";
import Promotions from "@/pages/promotions";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.getState().isAuthenticated);

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setIsAuthenticated(state.isAuthenticated);
    });
    return unsubscribe;
  }, []);

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.getState().isAuthenticated);
  const [user, setUser] = useState(authService.getState().user);

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setIsAuthenticated(state.isAuthenticated);
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  const getDefaultRoute = () => {
    if (!isAuthenticated) return "/login";
    if (user?.role === "merchant") return "/merchant-dashboard";
    if (user?.role === "employee") return "/employee-dashboard";
    if (user?.role === "client") return "/client-dashboard";
    return "/dashboard"; // admin dashboard
  };

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/merchant-dashboard" component={() => <ProtectedRoute component={MerchantDashboard} />} />
      <Route path="/merchant-settings" component={MerchantSettings} />
      <Route path="/employee-days-off" component={EmployeeDaysOff} />
      <Route path="/merchant-penalties" component={MerchantPenalties} />
      <Route path="/employee-dashboard" component={() => <ProtectedRoute component={EmployeeDashboard} />} />
      <Route path="/client-dashboard" component={() => <ProtectedRoute component={ClientDashboard} />} />
      <Route path="/new-appointment" component={() => <ProtectedRoute component={NewAppointment} />} />
      <Route path="/schedule" component={() => <ProtectedRoute component={Schedule} />} />
      <Route path="/services" component={() => <ProtectedRoute component={Services} />} />
      <Route path="/employees" component={Employees} />
      <Route path="/clients" component={Clients} />
      <Route path="/services" component={Services} />
      <Route path="/merchants" component={() => <ProtectedRoute component={Merchants} />} />
      <Route path="/merchant-access" component={() => <ProtectedRoute component={MerchantAccess} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/client-booking" component={ClientBooking} />
      <Route path="/promotions" component={Promotions} />
      <Route path="/">
        <Redirect to={getDefaultRoute()} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;