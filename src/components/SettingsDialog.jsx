import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Key } from "lucide-react";

function SettingsDialog({ open, onOpenChange }) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");

  // Load saved settings
  useEffect(() => {
    const savedKey = localStorage.getItem("chess-coach-api-key") || "";
    const savedModel = localStorage.getItem("chess-coach-model") || "gpt-4o-mini";
    setApiKey(savedKey);
    setModel(savedModel);
  }, [open]);

  function handleSave() {
    localStorage.setItem("chess-coach-api-key", apiKey);
    localStorage.setItem("chess-coach-model", model);
    onOpenChange(false);
  }

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
}

export default SettingsDialog;
