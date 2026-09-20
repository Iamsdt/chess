/** S02 · Grove Bloom design system: tokens, shadcn/ui primitives, project primitives.
 *  Every downstream sprint imports UI from here and nowhere else. */

export { cn } from './lib/utils'

/* Theme — persisted under the prototype's `ck-*` keys. */
export {
  BOARD_THEMES,
  PIECE_SETS,
  STORAGE_KEYS,
  THEME_MODES,
  ThemeProvider,
  useTheme,
  type BoardTheme,
  type PieceSet,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemeMode,
  type ThemeProviderProps,
} from './theme'

/* Project primitives. */
export {
  CtaButton,
  ctaButtonVariants,
  EmptyState,
  MOVE_QUALITIES,
  PageHeader,
  QualityGlyph,
  RingProgress,
  SectionHeader,
  StatCard,
  ThemeToggle,
  type CtaButtonProps,
  type EmptyStateProps,
  type MoveQuality,
  type PageHeaderProps,
  type QualityGlyphProps,
  type RingProgressProps,
  type SectionHeaderProps,
  type StatCardProps,
  type StatTrend,
  type ThemeToggleProps,
} from './components'

/* shadcn/ui primitives (new-york style, Radix + cva). */
export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './ui/avatar'
export { Badge, badgeVariants } from './ui/badge'
export { Button, buttonVariants } from './ui/button'
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
export { Input } from './ui/input'
export { Progress } from './ui/progress'
export { ScrollArea, ScrollBar } from './ui/scroll-area'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select'
export { Separator } from './ui/separator'
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet'
export { Slider } from './ui/slider'
export { Toaster } from './ui/sonner'
export { Switch } from './ui/switch'
export { Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger } from './ui/tabs'
export { Textarea } from './ui/textarea'
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

/* `toast()` is re-exported so features never import sonner directly. */
export { toast } from 'sonner'
