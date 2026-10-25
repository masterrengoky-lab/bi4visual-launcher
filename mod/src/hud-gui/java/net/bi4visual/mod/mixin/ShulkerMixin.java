package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.bi4visual.mod.Hud;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.world.inventory.Slot;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** ShulkerView: a shulker box under the mouse shows its 27 slots as a grid instead of a text tooltip. */
@Mixin(AbstractContainerScreen.class)
public abstract class ShulkerMixin {
    @Shadow protected Slot hoveredSlot;

    @Inject(method = "renderTooltip", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$noText(GuiGraphics g, int mouseX, int mouseY, CallbackInfo ci) {
        if (shown()) ci.cancel();
    }

    @Inject(method = "render", at = @At("TAIL"), require = 0)
    private void bi4visual$grid(GuiGraphics g, int mouseX, int mouseY, float partial, CallbackInfo ci) {
        if (shown()) Hud.shulker(g, hoveredSlot.getItem(), mouseX, mouseY);
    }

    private boolean shown() {
        return Config.get().shulkerView && hoveredSlot != null && hoveredSlot.hasItem() && Hud.isShulker(hoveredSlot.getItem());
    }
}
