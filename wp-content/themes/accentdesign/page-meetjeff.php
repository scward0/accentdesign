
<?php
/*
  Template Name: Meet Jeff
*/
?>

<?php if ( have_posts() ) : while ( have_posts() ) : the_post(); ?>
  <div class="container">
    <div style="background: url('<?php the_post_thumbnail_url(); ?>'); height: 100%; background-attachment: fixed; background-position: center; background-repeat: no-repeat; background-size: cover;">
      <?php get_header(); ?>
      <div class="row headline">
        <h1 class="text-center" style="color: white; font-size: 50px; text-transform:uppercase;"><?php the_title(); ?></h1>
        <br>
      </div>
      <div class="arrow">
        <img src="http://redirectdevhosting.com/wp-content/uploads/2016/12/arrow-down@2x.png" alt="Arrow Down" width="100px" style="position: absolute; top: 90%; left: 50%; transform: translateX(-50%) translateY(-50%);" />
      </div>
    </div>
  </div>

  <div class="container" style="background: #4d4d4d;">
    <div class="row" style="padding: 3%;">
      <?php
      $phrase = get_the_content();
      $phrase = apply_filters('the_content', $phrase);
      $replace = '<p style="color: white;">';
      echo str_replace('<p>', $replace, $phrase);
      ?>
    </div>
  </div>

<?php endwhile; else : ?>

  <p><?php _e( 'Sorry, no pages found' ); ?></p>

<?php endif; ?>

<?php get_footer(); ?>
