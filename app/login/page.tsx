import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>업무 관리</CardTitle>
          <CardDescription>계정으로 로그인하면 나의 업무 기록을 이어서 볼 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                로그인
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                회원가입
              </TabsTrigger>
            </TabsList>
            {error ? (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <TabsContent value="signin" className="mt-4">
              <form action={signIn}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="signin-email">이메일</FieldLabel>
                    <Input id="signin-email" name="email" type="email" required autoComplete="email" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signin-password">비밀번호</FieldLabel>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </Field>
                  <Button type="submit" className="w-full">
                    로그인
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form action={signUp}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
                    <Input id="signup-email" name="email" type="email" required autoComplete="email" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Button type="submit" className="w-full">
                    회원가입
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
