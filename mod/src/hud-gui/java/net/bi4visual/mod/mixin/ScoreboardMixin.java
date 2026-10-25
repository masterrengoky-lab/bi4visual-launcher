package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.bi4visual.mod.Hud;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.scores.Objective;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** CustomScoreboard: the sidebar is drawn as a bi4visual panel. */
@Mixin(Gui.class)
public abstract class ScoreboardMixin {
    @Inject(method = "displayScoreboardSidebar", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$sidebar(GuiGraphics g, Objective objective, CallbackInfo ci) {
        Config.Data d = Config.get();
        if (!d.scoreboard || !d.hud) return;
        ci.cancel();
        Hud.scoreboard(g, objective);
    }
}
