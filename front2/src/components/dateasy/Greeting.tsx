export function Greeting() {
  return (
    <div className="px-5 pt-6">
      <p className="text-sm text-muted-foreground">Привет, Алекс 👋</p>
      <h1 className="mt-2 text-[34px] leading-[1.05] font-semibold">
        Найди свою <span className="bg-lime-gradient text-lime-foreground rounded-2xl px-3 pb-1 inline-block leading-[1.1]">встречу</span>{" "}
        <br />
        сегодня вечером
      </h1>
    </div>
  );
}
