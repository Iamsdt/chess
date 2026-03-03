import { Key } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";

/**
 *
 */
const SettingsDialog = ({ open, onOpenChange }) => {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [elo, setElo] = useState("1000");

  // Load saved settings
  useEffect(() => {
    const savedKey = localStorage.getItem("chess-coach-api-key") || "";
    const savedModel =
      localStorage.getItem("chess-coach-model") || "gpt-4o-mini";
    const savedElo = localStorage.getItem("chess-coach-elo") || "1000";
    setApiKey(savedKey);
    setModel(savedModel);
    setElo(savedElo);
  }, [open]);

  /**
   *
   */
  const handleSave = () => {
    localStorage.setItem("chess-coach-api-key", apiKey);
    localStorage.setItem("chess-coach-model", model);
    const parsedElo = Math.max(100, Math.min(3000, parseInt(elo, 10) || 1000));
    localStorage.setItem("chess-coach-elo", String(parsedElo));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Enter your OpenAI API key. It is stored only in your browser.
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
              Used by the intelligence layer to tailor move suggestions to your
              level.
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

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
