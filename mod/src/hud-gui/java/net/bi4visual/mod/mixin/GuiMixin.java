package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.bi4visual.mod.Hud;
import net.bi4visual.mod.Keys;
import net.bi4visual.mod.Modules;
import net.bi4visual.mod.ModulesScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiGraphics;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** 1.21.x: our HUD goes on top of the vanilla one; the per-frame module work runs here too. */
@Mixin(Gui.class)
public class GuiMixin {
    @Inject(method = "render", at = @At("TAIL"), require = 0)
    private void bi4visual$hud(GuiGraphics graphics, DeltaTracker delta, CallbackInfo ci) {
        Minecraft mc = Minecraft.getInstance();
        // In the world, Right Shift opens the visuals menu and closes it again.
        if (Keys.rightShiftPressed() && !ModulesScreen.capturing()) {
            if (mc.screen == null) mc.setScreen(new ModulesScreen());
            else if (mc.screen instanceof ModulesScreen) mc.screen.onClose();
        }
        Modules.frame();
        Hud.render(graphics);
    }

    /** The glass hotbar replaces the vanilla one. */
    @Inject(method = "renderItemHotbar", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$hotbar(GuiGraphics graphics, DeltaTracker delta, CallbackInfo ci) {
        Config.Data d = Config.get();
        if (!d.hotbar || !d.hud) return;
        ci.cancel();
        Hud.hotbar(graphics);
    }

    /** Our own crosshair is drawn by the HUD instead. */
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$crosshair(GuiGraphics graphics, DeltaTracker delta, CallbackInfo ci) {
        if (!"off".equals(Config.get().crosshair)) ci.cancel();
    }
}
