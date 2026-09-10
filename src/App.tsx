import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RestaurantProvider } from './context/RestaurantContext';
import { MarketingPage } from './components/marketing/MarketingPage';
import { OnboardingWizard } from './components/auth/OnboardingWizard';
import { POSDashboard } from './components/pos/POSDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Tillora Application Shell Failure">
      <BrowserRouter>
        <RestaurantProvider>
          <Routes>
            {/* Marketing Website Routes */}
            <Route path="/" element={<MarketingPage />} />
            
            {/* POS Application Routes */}
            <Route path="/app/*" element={<POSDashboard />} />
            <Route path="/pos/*" element={<POSDashboard />} />
            <Route path="/login" element={<POSDashboard />} />
            <Route path="/get-started" element={<OnboardingWizard />} />
            <Route path="/signup" element={<OnboardingWizard />} />
            <Route path="/onboarding" element={<OnboardingWizard />} />
            <Route path="/demo" element={<POSDashboard />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RestaurantProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
