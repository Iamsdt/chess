import { Key } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import { GEMINI_MODELS } from "@/lib/google-ai";

const OPENAI_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

/**
 *
 */
const SettingsDialog = ({ open, onOpenChange }) => {
  const [provider, setProvider] = useState("google");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleModel, setGoogleModel] = useState("gemini-2.5-flash");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [elo, setElo] = useState("1000");

  useEffect(() => {
    if (!open) return;
    setProvider(localStorage.getItem("chess-ai-provider") || "google");
    setGoogleApiKey(localStorage.getItem("chess-google-api-key") || "");
    setGoogleModel(
      localStorage.getItem("chess-google-model") || "gemini-2.5-flash",
    );
    setOpenaiApiKey(localStorage.getItem("chess-coach-api-key") || "");
    setOpenaiModel(localStorage.getItem("chess-coach-model") || "gpt-4o-mini");
    setElo(localStorage.getItem("chess-coach-elo") || "1000");
  }, [open]);

  /**
   *
   */
  const handleSave = () => {
    const parsedElo = Math.max(100, Math.min(3000, parseInt(elo, 10) || 1000));
    localStorage.setItem("chess-ai-provider", provider);
    localStorage.setItem("chess-google-api-key", googleApiKey);
    localStorage.setItem("chess-google-model", googleModel);
    localStorage.setItem("chess-coach-api-key", openaiApiKey);
    localStorage.setItem("chess-coach-model", openaiModel);
    localStorage.setItem("chess-coach-elo", String(parsedElo));
    onOpenChange(false);
  };

  const isGoogle = provider === "google";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI coach. API keys are stored only in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ELO Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your ELO Rating</label>
            <Input
              type="number"
              placeholder="1000"
              min={100}
              max={3000}
              value={elo}
              onChange={(e) => setElo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used to tailor coaching depth and vocabulary to your level.
            </p>
          </div>

          {/* AI Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">AI Provider</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider("google")}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  isGoogle
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent hover:bg-accent"
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => setProvider("openai")}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  !isGoogle
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent hover:bg-accent"
                }`}
              >
                OpenAI
              </button>
            </div>
          </div>

          {/* Google Gemini fields */}
          {isGoogle && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Google API Key</label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your key at{" "}
                  <span className="font-mono">aistudio.google.com</span>
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gemini Model</label>
                <select
                  value={googleModel}
                  onChange={(e) => setGoogleModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.description}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Gemini models support agentic board control — the AI can move
                  pieces and set positions while teaching.
                </p>
              </div>
            </>
          )}

          {/* OpenAI fields */}
          {!isGoogle && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">OpenAI API Key</label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {OPENAI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
