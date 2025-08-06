import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="p-10">
      <Card>
        <CardHeader>
          <CardTitle>Hello from shadcn/ui</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is our first styled component.</p>
        </CardContent>
      </Card>
    </main>
  );
}
