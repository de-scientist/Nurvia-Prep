"use client";

import * as React from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { nurviaApi } from "@/lib/api-client";
import type { MentorProfileDto } from "@/lib/api-types";
import {
  Users,
  ShieldCheck,
  Star,
  Globe2,
  Calendar,
  MessageSquare,
  CheckCircle2,
  X,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const SPECIALTY_PILLS = [
  "All",
  "NCLEX prep",
  "Med-Surg",
  "ICU",
  "ER",
  "L&D",
  "Peds",
  "Psych",
  "OR",
  "Travel nursing",
  "IEN / licensure abroad",
  "New grad transition",
  "NP school",
  "Nurse education",
];

export default function MentorsPage() {
  const { status } = useAuth();
  const [mentors, setMentors] = React.useState<MentorProfileDto[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  // Modal state
  const [selectedMentor, setSelectedMentor] = React.useState<MentorProfileDto | null>(null);
  const [requestTopic, setRequestTopic] = React.useState("Clinical Transition Guidance");
  const [requestTrack, setRequestTrack] = React.useState("NCLEX-RN");
  const [requestMessage, setRequestMessage] = React.useState("");
  const [submittingRequest, setSubmittingRequest] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const fetchMentors = React.useCallback(async () => {
    setLoading(true);
    const res = await nurviaApi.getMentors({
      specialty: selectedSpecialty === "All" ? undefined : selectedSpecialty,
      search: search.trim() || undefined,
    });
    if (res.success && res.data) {
      setMentors(res.data);
    }
    setLoading(false);
  }, [selectedSpecialty, search]);

  React.useEffect(() => {
    void fetchMentors();
  }, [fetchMentors]);

  const handleOpenRequest = (mentor: MentorProfileDto) => {
    setSelectedMentor(mentor);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentor) return;

    setSubmittingRequest(true);
    const res = await nurviaApi.requestMentorSession({
      mentorId: selectedMentor.id,
      topic: requestTopic,
      examTrack: requestTrack,
      message: requestMessage,
      preferredCadence: "Flexible",
    });

    if (res.success) {
      setToastMessage(res.message);
      setSelectedMentor(null);
      setRequestMessage("");
    } else {
      setToastMessage(res.message);
    }
    setSubmittingRequest(false);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <PublicShell>
      <div className="bg-background text-foreground min-h-screen">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-brand-teal px-4 py-3 text-xs font-semibold text-white shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        {/* Header Hero */}
        <section className="border-b border-border bg-gradient-to-b from-surface/80 via-background to-background py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Clinical Mentors</span>
              </div>
              <h1 className="font-brand text-2xl sm:text-3xl font-extrabold text-foreground">
                Nurse Mentors Directory
              </h1>
              <p className="text-xs sm:text-sm text-foreground-secondary max-w-2xl">
                Verified practicing nurses and nurse educators who volunteer to guide nursing students, licensure candidates, and new graduates through clinical milestones.
              </p>
            </div>

            {/* Specialty Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-4">
              {SPECIALTY_PILLS.map((pill) => (
                <Button
                  key={pill}
                  size="sm"
                  variant={selectedSpecialty === pill ? "primary" : "outline"}
                  onClick={() => setSelectedSpecialty(pill)}
                  className="text-xs h-7 px-3 rounded-full"
                >
                  {pill}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Mentors Grid */}
        <section className="py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="py-16 text-center text-sm text-foreground-secondary" aria-live="polite">
                Loading mentor directory…
              </div>
            ) : mentors.length === 0 ? (
              <Card className="p-12 text-center space-y-3">
                <p className="font-semibold text-foreground">No mentors currently registered for {selectedSpecialty}.</p>
                <p className="text-xs text-foreground-secondary">
                  Are you an experienced nurse interested in mentoring the next generation?
                </p>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {mentors.map((mentor) => (
                  <Card
                    key={mentor.id}
                    className="p-5 border border-border bg-surface flex flex-col justify-between gap-5 shadow-xs hover:border-brand-teal/40 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-brand-teal/15 text-brand-teal flex items-center justify-center font-bold text-base shrink-0">
                          <Stethoscope className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-brand font-bold text-sm text-foreground truncate">
                              {mentor.name}
                            </h3>
                            {mentor.isVerified && (
                              <span title="Credential Verified">
                                <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-brand-teal font-medium">
                            {mentor.qualification}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-foreground-muted mt-0.5">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="font-bold text-foreground">{mentor.rating}</span>
                            <span>({mentor.reviewCount} sessions)</span>
                            <span>·</span>
                            <span>{mentor.experienceYears} yrs exp</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-foreground-secondary leading-relaxed line-clamp-3">
                        {mentor.bio}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {mentor.specialties.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-muted text-foreground-secondary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      <div className="text-[11px] text-foreground-muted flex items-center gap-1.5 pt-1">
                        <Globe2 className="w-3 h-3 text-brand-teal" />
                        <span>Languages: {mentor.languages.join(", ")}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        ● {mentor.availabilityStatus}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleOpenRequest(mentor)}
                        className="text-xs h-7 bg-brand-teal text-white hover:bg-brand-teal-dark"
                      >
                        Request Guidance
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Mentorship Request Modal */}
        {selectedMentor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-brand font-bold text-lg text-foreground">
                    Request Guidance from {selectedMentor.name}
                  </h3>
                  <p className="text-xs text-foreground-muted">
                    {selectedMentor.qualification} · {selectedMentor.specialties.join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMentor(null)}
                  className="text-foreground-muted hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Focus Area</label>
                  <select
                    value={requestTopic}
                    onChange={(e) => setRequestTopic(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  >
                    <option value="NCLEX Prioritization & Pacing">NCLEX Prioritization & Pacing</option>
                    <option value="Study Plan & Timeline Review">Study Plan & Timeline Review</option>
                    <option value="Clinical Residency & First Year Prep">Clinical Residency & First Year Prep</option>
                    <option value="IEN Credentialing & US State Board Registration">IEN Credentialing & US State Board Registration</option>
                    <option value="Test Anxiety & Exam Strategy">Test Anxiety & Exam Strategy</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Target Examination / Stage</label>
                  <select
                    value={requestTrack}
                    onChange={(e) => setRequestTrack(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  >
                    <option value="NCLEX-RN">NCLEX-RN</option>
                    <option value="NCLEX-PN">NCLEX-PN</option>
                    <option value="ATI Predictor">ATI Comprehensive Predictor</option>
                    <option value="HESI Exit">HESI Exit</option>
                    <option value="TEAS 7">ATI TEAS 7</option>
                    <option value="New Grad Nurse">New Graduate Nurse</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Message to Mentor</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Share what specific guidance or questions you have. Never include real test questions or patient information."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedMentor(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingRequest}
                    className="text-xs bg-brand-teal text-white hover:bg-brand-teal-dark"
                  >
                    {submittingRequest ? "Sending…" : "Send Request"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
