package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Anim;
import net.bi4visual.mod.Config;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** BetterMinecraft: chests and the inventory grow in from 85% when they open. */
@Mixin(AbstractContainerScreen.class)
public abstract class BetterMixin {
    @Unique private boolean bi4visual$pushed;

    @Inject(method = "init", at = @At("HEAD"), require = 0)
    private void bi4visual$opened(CallbackInfo ci) {
        Anim.opened();
    }

    @Inject(method = "render", at = @At("HEAD"), require = 0)
    private void bi4visual$start(GuiGraphics g, int mouseX, int mouseY, float partial, CallbackInfo ci) {
        bi4visual$pushed = false;
        if (!Config.get().better) return;
        float p = Anim.openProgress();
        if (p >= 1f) return;
        bi4visual$pushed = Anim.pushScale(g, 0.85f + 0.15f * p, g.guiWidth() / 2f, g.guiHeight() / 2f);
    }

    @Inject(method = "render", at = @At("RETURN"), require = 0)
    private void bi4visual$end(GuiGraphics g, int mouseX, int mouseY, float partial, CallbackInfo ci) {
        if (bi4visual$pushed) Anim.pop(g);
        bi4visual$pushed = false;
    }
}
