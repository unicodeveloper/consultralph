"use client";

import { useState } from "react";
import { Building2, Check, Loader2, ExternalLink, X } from "lucide-react";

interface EnterpriseContactModalProps {
  open: boolean;
  onClose: () => void;
}

const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "501-1000 employees",
  "1000+ employees",
];

const INDUSTRIES = [
  "Hedge Fund",
  "Investment Bank",
  "Asset Management",
  "Private Equity",
  "Venture Capital",
  "Financial Services",
  "Research Firm",
  "Technology",
  "Consulting",
  "Other",
];

export default function EnterpriseContactModal({ open, onClose }: EnterpriseContactModalProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    companySize: "",
    industry: "",
    contactName: "",
    contactEmail: "",
    jobTitle: "",
    useCase: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [bookedCall, setBookedCall] = useState(false);

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isFormValid = () => {
    return formData.companyName && formData.contactName && formData.contactEmail && formData.jobTitle && formData.useCase;
  };

  const handleSubmit = async (shouldBookCall: boolean) => {
    if (!isFormValid()) return;

    setIsSubmitting(true);
    setBookedCall(shouldBookCall);

    try {
      const response = await fetch("/api/enterprise/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, bookedCall: shouldBookCall }),
      });

      if (response.ok) {
        setSubmitSuccess(true);

        if (shouldBookCall) {
          window.open("https://calendly.com/henk-valyu/coffee-chat-with-hendrik", "_blank");
        }

        setTimeout(() => {
          setFormData({
            companyName: "",
            companySize: "",
            industry: "",
            contactName: "",
            contactEmail: "",
            jobTitle: "",
            useCase: "",
          });
          setSubmitSuccess(false);
          setBookedCall(false);
          onClose();
        }, 3000);
      }
    } catch {
      // Silently fail - user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-surface rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5 text-text-muted" />
        </button>

        {submitSuccess ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Thanks for your enquiry</h3>
            <p className="text-sm text-text-muted">
              {bookedCall ? "Booking call with Hendrik" : "We'll be in touch soon"}
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-surface rounded-2xl mb-4">
                <Building2 className="w-7 h-7 text-foreground" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Enterprise Consulting Intelligence
              </h2>
              <p className="text-text-muted text-sm max-w-md mx-auto">
                Deploy enterprise-grade research and AI consulting agents with zero data retention, dedicated infrastructure, and custom data sources
              </p>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Company Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Company Details</h3>

                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-text-muted mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companySize" className="block text-sm font-medium text-text-muted mb-1">
                      Company Size
                    </label>
                    <select
                      id="companySize"
                      name="companySize"
                      value={formData.companySize}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    >
                      <option value="">Select size</option>
                      {COMPANY_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="industry" className="block text-sm font-medium text-text-muted mb-1">
                      Industry
                    </label>
                    <select
                      id="industry"
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    >
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((industry) => (
                        <option key={industry} value={industry}>{industry}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Your Details</h3>

                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium text-text-muted mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contactEmail" className="block text-sm font-medium text-text-muted mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="contactEmail"
                      name="contactEmail"
                      value={formData.contactEmail}
                      onChange={handleChange}
                      placeholder="john@acme.com"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-text-muted mb-1">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="jobTitle"
                      name="jobTitle"
                      value={formData.jobTitle}
                      onChange={handleChange}
                      placeholder="VP of Research"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Use Case */}
              <div>
                <label htmlFor="useCase" className="block text-sm font-medium text-text-muted mb-1">
                  Tell us about your needs <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="useCase"
                  name="useCase"
                  value={formData.useCase}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                  placeholder="Describe your use case, team size, specific requirements, or integration needs..."
                />
              </div>

              {/* Trust Signal */}
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">Enterprise-grade security</p>
                    <p className="text-text-muted">Trusted by leading financial institutions worldwide</p>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={() => handleSubmit(true)}
                disabled={!isFormValid() || isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Submit & Book Call</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
