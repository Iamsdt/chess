import {
  Bell,
  Brain,
  Crosshair,
  Flame,
  MessageCircle,
  Play,
  Search,
  Sprout,
  Target,
  Timer,
  Trash2,
} from 'lucide-react'
import { useId, useState } from 'react'

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CtaButton,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  MOVE_QUALITIES,
  PageHeader,
  Progress,
  QualityGlyph,
  RingProgress,
  ScrollArea,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Slider,
  StatCard,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/design'

const SURFACE_TOKENS = [
  'background',
  'foreground',
  'card',
  'popover',
  'primary',
  'secondary',
  'muted',
  'accent',
  'destructive',
  'border',
  'input',
  'ring',
] as const

const BRAND_TOKENS = [
  'cta',
  'cta-strong',
  'cta-soft',
  'reward',
  'reward-soft',
  'sky',
  'lilac',
  'success',
] as const

const BOARD_SCOPES = ['grove', 'walnut', 'slate', 'dusk', 'sand'] as const

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} />
      {children}
    </section>
  )
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="space-y-1">
      <div
        className="h-12 rounded-lg border"
        style={{ background: `var(--${token})` }}
        aria-hidden="true"
      />
      <code className="block font-mono text-[10px] text-muted-foreground">--{token}</code>
    </div>
  )
}

/** Every component in the system, rendered once. The kitchen sink mounts it twice —
 *  inside `.light` and inside `.dark` — so a reviewer can diff the two palettes. */
export function Gallery() {
  const searchId = useId()
  const notesId = useId()
  const spoilersId = useId()
  const [strength, setStrength] = useState([1200])

  return (
    <TooltipProvider>
      <div className="space-y-10 bg-background p-6 text-foreground">
        <PageHeader
          eyebrow="Puzzles"
          title="Sharpen your eye"
          description="Short sets, tuned to you. Play the move, don't just read it."
          actions={
            <>
              <Badge variant="reward">
                <Flame aria-hidden="true" />
                12-day streak
              </Badge>
              <Badge variant="muted">
                <Target aria-hidden="true" />
                Today 4 of 10
              </Badge>
            </>
          }
        />

        <Block title="Colour tokens">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {SURFACE_TOKENS.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {BRAND_TOKENS.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
            {MOVE_QUALITIES.map((quality) => (
              <Swatch key={quality} token={`q-${quality}`} />
            ))}
          </div>
        </Block>

        <Block title="Board palettes">
          <div className="flex flex-wrap gap-4">
            {BOARD_SCOPES.map((board) => (
              <div key={board} className="space-y-1.5 text-center">
                <div
                  {...(board === 'grove' ? {} : { 'data-board': board })}
                  className="grid size-14 grid-cols-2 grid-rows-2 overflow-hidden rounded-xl ring-1 ring-border"
                  aria-hidden="true"
                >
                  <span style={{ background: 'var(--vb-light)' }} />
                  <span style={{ background: 'var(--vb-dark)' }} />
                  <span style={{ background: 'var(--vb-dark)' }} />
                  <span style={{ background: 'var(--vb-light)' }} />
                </div>
                <span className="text-xs font-medium capitalize">{board}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Typography">
          <div className="space-y-2">
            <p className="eyebrow">Eyebrow · uppercase meta</p>
            <h1 className="page-title">Give five mistakes a second chance</h1>
            <p className="text-sm text-muted-foreground">
              Body copy at 14px. A move renders as <span className="san">Nf3+</span> and a shortcut
              as <kbd className="kbd">⌘K</kbd>.
            </p>
            <p className="label">Label · the small caption above a number</p>
          </div>
        </Block>

        <Block title="Button">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">
              <Trash2 aria-hidden="true" />
              Destructive
            </Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="outline" aria-label="Search">
              <Search aria-hidden="true" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Notifications">
              <Bell aria-hidden="true" />
            </Button>
          </div>
        </Block>

        <Block title="CtaButton">
          <div className="flex flex-wrap items-center gap-3">
            <CtaButton size="sm">Small</CtaButton>
            <CtaButton>
              <Play aria-hidden="true" />
              Start · 4 min
            </CtaButton>
            <CtaButton size="lg">Large</CtaButton>
            <CtaButton disabled>Disabled</CtaButton>
          </div>
          <CtaButton block asChild>
            <a href="#gallery-top">As a link, full width</a>
          </CtaButton>
        </Block>

        <Block title="Badge">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="soft">
              <Crosshair aria-hidden="true" />
              Today&apos;s focus
            </Badge>
            <Badge variant="cta">Last step</Badge>
            <Badge variant="reward">
              <Flame aria-hidden="true" />
              Streak
            </Badge>
            <Badge variant="sky">Freeze</Badge>
            <Badge variant="lilac">Coach</Badge>
            <Badge variant="destructive">Blunder</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="muted">+6</Badge>
          </div>
        </Block>

        <Block title="QualityGlyph">
          <div className="flex flex-wrap items-center gap-3">
            {MOVE_QUALITIES.map((quality) => (
              <span key={quality} className="flex items-center gap-1.5 text-xs">
                <QualityGlyph quality={quality} />
                <span className="capitalize">{quality}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <QualityGlyph quality="brilliant" size="sm" />
            <QualityGlyph quality="brilliant" />
            <QualityGlyph quality="brilliant" size="lg" />
          </div>
        </Block>

        <Block title="StatCard">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Puzzle rating" value="1482" hint="+64 from 1418" trend="up" />
            <StatCard
              label="Sparring rating"
              value="1180"
              hint="-12 this week"
              trend="down"
              size="lg"
            />
            <StatCard
              label="Solve rate, last 50"
              value="74%"
              hint="Target 75%"
              size="sm"
              action={<Badge variant="soft">Tuned</Badge>}
            />
          </div>
        </Block>

        <Block title="RingProgress">
          <div className="flex flex-wrap items-center gap-6">
            <RingProgress value={0} label="Today's path, empty" />
            <RingProgress value={38} label="Course progress" tone="cta" />
            <RingProgress value={67} label="Weekly goal" tone="reward" size={72} thickness={6} />
            <RingProgress value={100} label="Set complete" tone="success" size={120} thickness={10}>
              <span className="font-display text-2xl font-bold">10/10</span>
            </RingProgress>
          </div>
        </Block>

        <Block title="SectionHeader">
          <SectionHeader
            icon={Brain}
            title="Sage noticed this week"
            meta="From your last 9 games"
          />
          <SectionHeader
            title="Ways to train"
            action={
              <Button size="sm" variant="ghost">
                See all
              </Button>
            }
          />
        </Block>

        <Block title="Card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Continue adaptive puzzles</CardTitle>
                <CardDescription>Picked from your weakest theme.</CardDescription>
                <CardAction>
                  <Badge variant="soft">4 of 10</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Progress value={40} aria-label="Adaptive set progress" />
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">
                  <MessageCircle aria-hidden="true" />
                  Why forks?
                </Button>
              </CardFooter>
            </Card>
            <div className="card card-hover flex flex-col p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-cta-soft text-cta">
                <Timer aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-3 text-lg font-bold">Puzzle Rush</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                3 or 5 minutes. Three strikes. Ported prototype markup, unchanged.
              </p>
              <span className="mt-auto pt-4 text-xs text-muted-foreground">Your best: 23</span>
            </div>
          </div>
        </Block>

        <Block title="EmptyState">
          <EmptyState
            eyebrow="When a filter finds nothing"
            icon={Sprout}
            title="No Caro-Kann games as White yet"
            description="Play one against Stockfish and it will show up here."
            action={
              <Button size="sm" variant="outline">
                Clear filters
              </Button>
            }
          />
        </Block>

        <Block title="Form controls">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="field-label block" htmlFor={searchId}>
                Search games
              </label>
              <Input id={searchId} placeholder="Opponent, opening, ECO…" />
              <p className="help">Matches headers and comments.</p>
            </div>
            <div className="space-y-1.5">
              <label className="field-label block" htmlFor={notesId}>
                Notes
              </label>
              <Textarea id={notesId} rows={3} placeholder="What did the knight see?" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id={spoilersId} defaultChecked />
              <label className="field-label" htmlFor={spoilersId}>
                No spoilers
              </label>
            </div>
            <Select defaultValue="1200">
              <SelectTrigger className="w-44" aria-label="Engine strength">
                <SelectValue placeholder="Strength" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="800">Stockfish 800</SelectItem>
                <SelectItem value="1200">Stockfish 1200</SelectItem>
                <SelectItem value="1600">Stockfish 1600</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-w-sm space-y-2">
            <span className="field-label">Opponent rating · {strength[0] ?? 0}</span>
            <Slider
              value={strength}
              onValueChange={setStrength}
              min={600}
              max={2400}
              step={100}
              aria-label="Opponent rating"
            />
          </div>
          <Separator />
        </Block>

        <Block title="Tabs">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="wins">Wins</TabsTrigger>
              <TabsTrigger value="losses">Losses</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="text-sm text-muted-foreground">
              42 games.
            </TabsContent>
            <TabsContent value="wins" className="text-sm text-muted-foreground">
              21 games.
            </TabsContent>
            <TabsContent value="losses" className="text-sm text-muted-foreground">
              16 games.
            </TabsContent>
          </Tabs>
        </Block>

        <Block title="Progress, Avatar, ScrollArea">
          <div className="space-y-2">
            <Progress value={38} aria-label="Course progress" />
            <Progress value={100} aria-label="Set complete" />
          </div>
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback>ST</AvatarFallback>
            </Avatar>
            <AvatarGroup>
              <Avatar>
                <AvatarFallback>RA</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>MK</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </div>
          <ScrollArea className="h-28 w-full rounded-lg border p-3">
            <ol className="space-y-1">
              {Array.from({ length: 12 }, (_, index) => (
                <li key={index} className="mv">
                  {index + 1}. e4 e5
                </li>
              ))}
            </ol>
          </ScrollArea>
        </Block>

        <Block title="Overlays">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Resign this game?</DialogTitle>
                  <DialogDescription>
                    It still counts towards your review. Nothing is lost.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Keep playing</Button>
                  </DialogClose>
                  <Button variant="destructive">Resign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sage</SheetTitle>
                  <SheetDescription>The coach panel lives here on mobile.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Open menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Game</DropdownMenuLabel>
                <DropdownMenuItem>Download PGN</DropdownMenuItem>
                <DropdownMenuItem>Copy FEN</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Evaluation from the last completed depth.</TooltipContent>
            </Tooltip>

            <Button
              variant="secondary"
              onClick={() => toast.success('chess-king-games.pgn downloaded (42 games)')}
            >
              Fire a toast
            </Button>
          </div>
        </Block>
      </div>
    </TooltipProvider>
  )
}
