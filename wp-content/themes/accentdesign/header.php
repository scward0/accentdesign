<!doctype html>
<html class="no-js" lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?php wp_title(); ?></title>
    <link rel="stylesheet" href="http://198.58.102.147/accentdesign/wp-content/themes/accentdesign/css/foundation.css">
    <link rel="stylesheet" href="http://198.58.102.147/accentdesign/wp-content/themes/accentdesign/style.css">
    <?php wp_head(); ?>
  </head>

  <body <?php body_class(); ?>>



      <div id="header" class="fixed transition">
      <header class="row no-max pad main">
        <style media="screen">
        @media screen and (max-width: 768px){
          .desk-logo{
            display: none;
          }

        }
        </style>
        <a class="desk-logo" href="<?php bloginfo('url'); ?>"><img src="http://198.58.102.147/accentdesign/wp-content/uploads/2016/12/new_accent_logo-1.png" width="200" alt="<?php bloginfo('name'); ?>"/></a>
        <nav id="mainnav" class="mainnav" role="navigation">
          <?php
            $defaults = array(
              'container' => false,
              'theme_location' => 'primary-menu',
              'menu_class' => 'no-bullet menu sticky cap'
            );

            wp_nav_menu($defaults)
           ?>
        </nav>
      </header>
    </div>
