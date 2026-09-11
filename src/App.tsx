import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RestaurantProvider } from './context/RestaurantContext';
import { MarketingPage } from './components/marketing/MarketingPage';
import { FeaturesPage } from './components/marketing/FeaturesPage';
import { PricingPage } from './components/marketing/PricingPage';
import { DocsPage } from './components/marketing/DocsPage';
import { GuidesPage } from './components/marketing/GuidesPage';
import { ComparePage } from './components/marketing/ComparePage';
import { AboutPage } from './components/marketing/AboutPage';
import { ContactPage } from './components/marketing/ContactPage';
import { FAQPage } from './components/marketing/FAQPage';
import { LegalPage } from './components/marketing/LegalPage';
import { OnboardingWizard } from './components/auth/OnboardingWizard';
import { POSDashboard } from './components/pos/POSDashboard';
import { PlatformAdminDashboard } from './components/platform/PlatformAdminDashboard';
import { CustomerPortalDashboard } from './components/portal/CustomerPortalDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Tillora Application Shell Failure">
      <BrowserRouter>
        <RestaurantProvider>
          <Routes>
            {/* Marketing & Content Website Routes */}
            <Route path="/" element={<MarketingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/guides" element={<GuidesPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/privacy" element={<LegalPage initialTab="privacy" />} />
            <Route path="/terms" element={<LegalPage initialTab="terms" />} />
            <Route path="/security" element={<LegalPage initialTab="security" />} />
            <Route path="/compliance" element={<LegalPage initialTab="security" />} />
            
            {/* Dedicated Platform / Executive Admin Console */}
            <Route path="/platform-admin/*" element={<PlatformAdminDashboard />} />
            <Route path="/admin/*" element={<PlatformAdminDashboard />} />
            <Route path="/executive/*" element={<PlatformAdminDashboard />} />

            {/* Customer / Restaurant Owner Portal */}
            <Route path="/portal/*" element={<CustomerPortalDashboard />} />

            {/* Onboarding & Provisioning Routes */}
            <Route path="/get-started" element={<OnboardingWizard />} />
            <Route path="/signup" element={<OnboardingWizard />} />
            <Route path="/onboarding" element={<OnboardingWizard />} />

            {/* POS Application & Terminal Routes */}
            <Route path="/app/*" element={<POSDashboard />} />
            <Route path="/pos/*" element={<POSDashboard />} />
            <Route path="/login" element={<POSDashboard />} />
            <Route path="/demo" element={<POSDashboard />} />
            
            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RestaurantProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
