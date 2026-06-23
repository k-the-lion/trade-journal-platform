import { createClient, getProfile } from "@/lib/supabase/server";
import { StrategyManager } from "@/components/StrategyManager";
import { TagPresetManager } from "@/components/TagPresetManager";
import type { TradingStrategy, TradingTagPreset } from "@/lib/types/database";

export default async function StrategiesPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ data: strategies }, { data: tagPresets }] = await Promise.all([
    supabase
      .from("trading_strategies")
      .select("*")
      .eq("user_id", profile!.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("trading_tag_presets")
      .select("*")
      .eq("user_id", profile!.id)
      .order("sort_order")
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Strategies</h1>
        <p className="text-muted text-sm mt-1">
          Define your setups and rules. When you tag a trade with a strategy, you can
          record whether you followed that strategy&apos;s rules.
        </p>
      </div>
      <StrategyManager initialStrategies={(strategies ?? []) as TradingStrategy[]} />
      <TagPresetManager initialPresets={(tagPresets ?? []) as TradingTagPreset[]} />
    </div>
  );
}
