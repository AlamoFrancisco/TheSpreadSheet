'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@supabase/supabase-js';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Menu, ChevronDown, Wallet, LineChart, Building, PiggyBank, BadgePoundSterling, Goal } from 'lucide-react';

const supabase = createClientComponentClient();

const apps = [
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/mortgage', label: 'Mortgage', icon: Building },
  { href: '/retirement', label: 'Retirement', icon: LineChart },
  { href: '/salary', label: 'Net Salary', icon: BadgePoundSterling },
  { href: '/goals', label: 'Goals & Debt', icon: Goal },
  { href: '/roadmap', label: 'Financial Roadmap', icon: PiggyBank } ,
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = React.useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [firstName, setFirstName] = React.useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      setCheckingSession(false);

      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, photo_url')
          .eq('id', session.user.id)
          .single();
        if (!mounted) return;
        setFirstName(data?.first_name ?? null);
        setPhotoUrl(data?.photo_url ?? null);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => (pathname === href ? 'text-primary' : 'text-muted-foreground hover:text-foreground');

  return (
    <nav className="sticky top-0 z-50 w-full supports-[backdrop-filter]:bg-white/60 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="h-14 flex items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-semibold tracking-tight text-[17px] leading-none"
            >
              The Spreadsheet
            </Link>

            {/* Desktop Apps Menu */}
            <div className="hidden md:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    Apps <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Open an app</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {apps.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <Link href={href} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className={isActive(href)}>{label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop quick links */}
            <div className="hidden md:flex items-center gap-4 ml-2 text-sm">
              {apps.slice(0, 3).map(({ href, label }) => (
                <Link key={href} href={href} className={isActive(href)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Auth / Profile */}
          <div className="hidden md:flex items-center gap-2">
            {!checkingSession && session ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/profile')}
                  className="flex items-center gap-2"
                >
                  <Avatar className="h-6 w-6">
                    {photoUrl ? (
                      <AvatarImage src={photoUrl} alt="Avatar" />
                    ) : (
                      <AvatarFallback>{(firstName?.[0] ?? 'U').toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <span className="hidden sm:inline">{firstName ?? 'Profile'}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : !checkingSession ? (
              <Button size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
            ) : (
              // subtle skeleton while checking session
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            )}
          </div>

          {/* Mobile: hamburger */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>The Spreadsheet</SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">Apps</div>
                  <div className="grid grid-cols-1">
                    {apps.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`px-2 py-2 rounded hover:bg-muted ${isActive(href)}`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t pt-4 space-y-3">
                  {!checkingSession && session ? (
                    <>
                      <Button variant="ghost" className="w-full justify-start" onClick={() => router.push('/profile')}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {photoUrl ? (
                              <AvatarImage src={photoUrl} alt="Avatar" />
                            ) : (
                              <AvatarFallback>{(firstName?.[0] ?? 'U').toUpperCase()}</AvatarFallback>
                            )}
                          </Avatar>
                          <span>{firstName ?? 'Profile'}</span>
                        </div>
                      </Button>
                      <Button variant="outline" className="w-full" onClick={logout}>
                        Logout
                      </Button>
                    </>
                  ) : !checkingSession ? (
                    <Button asChild className="w-full">
                      <Link href="/login">Login</Link>
                    </Button>
                  ) : (
                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
