import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import {
  Lightbulb,
  MessageSquareText,
  Zap,
  Settings,
  RotateCcw,
} from "lucide-react";

function ControlBar({
  onExplain,
  onHint,
  isLiveMode,
  onToggleLiveMode,
  onNewGame,
  onOpenSettings,
  isLoading,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      {/* Left — branding */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold tracking-tight text-primary">
          ♟ AI Chess Coach
        </span>
      </div>

      {/* Center — action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExplain}
          disabled={isLoading}
        >
          <MessageSquareText className="h-4 w-4" />
          Explain
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onHint}
          disabled={isLoading}
        >
          <Lightbulb className="h-4 w-4" />
          Hint
        </Button>

        <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md bg-secondary">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Live</span>
          <Switch checked={isLiveMode} onCheckedChange={onToggleLiveMode} />
        </div>

        <Button variant="ghost" size="sm" onClick={onNewGame}>
          <RotateCcw className="h-4 w-4" />
          New Game
        </Button>
      </div>

      {/* Right — settings */}
      <Button variant="ghost" size="icon" onClick={onOpenSettings}>
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default ControlBar;
