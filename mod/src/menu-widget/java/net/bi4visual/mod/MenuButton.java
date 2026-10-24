package net.bi4visual.mod;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/** 1.21.4–1.21.10: the button draws itself in renderWidget. */
public class MenuButton extends Button {
    private final MenuScreen.Painter painter;

    public MenuButton(int x, int y, int w, int h, String text, MenuScreen.Painter painter, OnPress onPress) {
        super(x, y, w, h, Component.literal(text), onPress, DEFAULT_NARRATION);
        this.painter = painter;
    }

    @Override
    protected void renderWidget(GuiGraphics g, int mouseX, int mouseY, float partial) {
        painter.paint(g, this, isHovered());
    }
}
