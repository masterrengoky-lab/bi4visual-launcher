package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Hud;
import net.bi4visual.mod.Keys;
import net.bi4visual.mod.ModulesScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiGraphics;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** 1.21.x: our HUD goes on top of the vanilla one. */
@Mixin(Gui.class)
public class GuiMixin {
    @Inject(method = "render", at = @At("TAIL"), require = 0)
    private void bi4visual$hud(GuiGraphics graphics, DeltaTracker delta, CallbackInfo ci) {
        Minecraft mc = Minecraft.getInstance();
        // In the world, Right Shift opens the visuals menu and closes it again.
        if (Keys.rightShiftPressed()) {
            if (mc.screen == null) mc.setScreen(new ModulesScreen());
            else if (mc.screen instanceof ModulesScreen) mc.screen.onClose();
        }
        Hud.render(graphics);
    }
}
