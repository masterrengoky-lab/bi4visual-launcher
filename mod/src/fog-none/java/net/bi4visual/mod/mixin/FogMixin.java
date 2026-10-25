package net.bi4visual.mod.mixin;

import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;

/** 1.21.6 and newer set up fog differently; CustomFog is not there yet. */
@Mixin(Minecraft.class)
public class FogMixin {
}
